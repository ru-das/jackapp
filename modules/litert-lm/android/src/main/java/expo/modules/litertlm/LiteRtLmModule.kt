package expo.modules.litertlm

import android.util.Base64
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private const val TAG = "LiteRtLm"
// The catalog prompt is about 4K tokens and a spec up to 4K more.
private const val CONTEXT_TOKENS = 8192
private const val PARTIAL_EVERY_MS = 250L

class LiteRtLmModule : Module() {
  private var engine: Engine? = null
  private var enginePath: String? = null
  private var backendName = ""
  private var initMs = 0
  @Volatile private var active: Conversation? = null

  // Tries the GPU first; some phones ship no usable OpenCL driver, so any failure retries on the CPU.
  private fun engineFor(path: String): Engine {
    engine?.let { if (enginePath == path) return it }
    releaseEngine()
    val cacheDir = requireNotNull(appContext.reactContext) { "React context is gone" }.cacheDir.path
    val started = System.currentTimeMillis()
    var failure: Throwable? = null
    for (gpu in listOf(true, false)) {
      val backend = if (gpu) Backend.GPU() else Backend.CPU()
      try {
        val e = Engine(EngineConfig(
          modelPath = path, backend = backend, visionBackend = backend,
          maxNumTokens = CONTEXT_TOKENS, cacheDir = cacheDir,
        ))
        e.initialize()
        engine = e
        enginePath = path
        backendName = if (gpu) "GPU" else "CPU"
        initMs = (System.currentTimeMillis() - started).toInt()
        return e
      } catch (t: Throwable) {
        Log.w(TAG, "engine init on ${if (gpu) "GPU" else "CPU"} failed", t)
        failure = t
      }
    }
    throw failure ?: IllegalStateException("Engine init failed")
  }

  private fun releaseEngine() {
    active?.runCatching { cancelProcess() }
    engine?.runCatching { close() }
    engine = null
    enginePath = null
  }

  override fun definition() = ModuleDefinition {
    Name("LiteRtLm")
    Events("onPartial")

    AsyncFunction("generate") Coroutine { modelPath: String, system: String, prompt: String, images: List<String>, temperature: Double, maxTokens: Int ->
      withContext(Dispatchers.Default) {
        val wasLoaded = engine != null && enginePath == modelPath
        val e = engineFor(modelPath)
        val thinking = ThinkingConfig(enableThinking = false)
        val conversation = e.createConversation(ConversationConfig(
          systemInstruction = Contents.of(system),
          samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = temperature),
          maxOutputToken = maxTokens.takeIf { it > 0 },
          thinkingConfig = thinking,
        ))
        active = conversation
        try {
          val parts: List<Content> = images.map<String, Content> { Content.ImageBytes(Base64.decode(it, Base64.DEFAULT)) } + Content.Text(prompt)
          val started = System.currentTimeMillis()
          var firstTokenMs = -1
          var lastEvent = 0L
          val text = StringBuilder()
          suspendCancellableCoroutine<Unit> { cont ->
            conversation.sendMessageAsync(Contents.of(parts), object : MessageCallback {
              override fun onMessage(message: Message) {
                val now = System.currentTimeMillis()
                if (firstTokenMs < 0) firstTokenMs = (now - started).toInt()
                text.append(message.toString())
                if (now - lastEvent >= PARTIAL_EVERY_MS) {
                  lastEvent = now
                  sendEvent("onPartial", mapOf("chars" to text.length, "firstTokenMs" to firstTokenMs))
                }
              }
              override fun onDone() { if (cont.isActive) cont.resume(Unit) }
              override fun onError(throwable: Throwable) { if (cont.isActive) cont.resumeWithException(throwable) }
            }, maxOutputToken = maxTokens.takeIf { it > 0 }, thinkingConfig = thinking)
            cont.invokeOnCancellation { conversation.runCatching { cancelProcess() } }
          }
          mapOf(
            "text" to text.toString(),
            "backend" to backendName,
            // Zero when the model was already loaded for an earlier call.
            "initMs" to if (wasLoaded) 0 else initMs,
            "firstTokenMs" to firstTokenMs,
            "genMs" to (System.currentTimeMillis() - started).toInt(),
            "kvTokens" to runCatching { conversation.getTokenCount() }.getOrDefault(-1),
          )
        } finally {
          active = null
          conversation.close()
        }
      }
    }

    // The JS side calls this when the user cancels; the pending generate() then fails with the native error.
    Function("cancel") {
      active?.runCatching { cancelProcess() }
      Unit
    }

    Function("release") { releaseEngine() }

    OnDestroy { releaseEngine() }
  }
}
