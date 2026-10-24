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
import com.google.ai.edge.litertlm.ExperimentalApi
import com.google.ai.edge.litertlm.ExperimentalFlags
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.ResponseFormat
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private const val TAG = "LiteRtLm"
// The catalog prompt is about 4K tokens and a spec up to 4K more.
private const val CONTEXT_TOKENS = 8192
private const val PARTIAL_EVERY_MS = 250L
// Forces syntactically valid JSON (an object) and nothing more; our own validator checks the shape.
private const val ANY_JSON_OBJECT = """{"type":"object"}"""

class GenerateOptions : Record {
  @Field var modelPath: String = ""
  @Field var system: String = ""
  @Field var prompt: String = ""
  @Field var images: List<String> = emptyList()
  @Field var temperature: Double = 0.2
  @Field var maxTokens: Int = 0
  @Field var backend: String = "gpu"
  @Field var speculative: Boolean = false
  @Field var constrained: Boolean = false
}

class LiteRtLmModule : Module() {
  private var engine: Engine? = null
  private var engineKey = ""
  private var backendName = ""
  private var usedSpeculative = false
  private var initMs = 0
  @Volatile private var active: Conversation? = null
  // One engine, one conversation at a time; warm-up and generate must not interleave.
  private val lock = Mutex()

  // Tries what was asked for first, then drops speculative decoding, then the GPU: some phones have no
  // usable OpenCL driver and the speculative drafter is experimental, so any failure retries more plainly.
  @OptIn(ExperimentalApi::class)
  private fun engineFor(path: String, wantGpu: Boolean, speculative: Boolean): Engine {
    val key = "$path|$wantGpu|$speculative"
    engine?.let { if (engineKey == key) return it }
    releaseEngine()
    val cacheDir = requireNotNull(appContext.reactContext) { "React context is gone" }.cacheDir.path
    val started = System.currentTimeMillis()
    val attempts = buildList {
      add(wantGpu to speculative)
      if (speculative) add(wantGpu to false)
      if (wantGpu) add(false to false)
    }
    var failure: Throwable? = null
    for ((gpu, spec) in attempts) {
      val backend = if (gpu) Backend.GPU() else Backend.CPU()
      try {
        ExperimentalFlags.enableSpeculativeDecoding = if (spec) true else null
        val e = Engine(EngineConfig(
          modelPath = path, backend = backend, visionBackend = backend,
          maxNumTokens = CONTEXT_TOKENS, cacheDir = cacheDir,
        ))
        e.initialize()
        engine = e
        engineKey = key
        backendName = if (gpu) "GPU" else "CPU"
        usedSpeculative = spec
        initMs = (System.currentTimeMillis() - started).toInt()
        return e
      } catch (t: Throwable) {
        Log.w(TAG, "engine init failed (gpu=$gpu, speculative=$spec)", t)
        failure = t
      }
    }
    throw failure ?: IllegalStateException("Engine init failed")
  }

  private fun releaseEngine() {
    active?.runCatching { cancelProcess() }
    engine?.runCatching { close() }
    engine = null
    engineKey = ""
  }

  override fun definition() = ModuleDefinition {
    Name("LiteRtLm")
    Events("onPartial")

    // Loads the model ahead of the first request so the user does not wait for it.
    AsyncFunction("warmUp") Coroutine { modelPath: String, backend: String, speculative: Boolean ->
      withContext(Dispatchers.Default) {
        lock.withLock {
          val loaded = engine != null && engineKey == "$modelPath|${backend == "gpu"}|$speculative"
          engineFor(modelPath, backend == "gpu", speculative)
          mapOf("backend" to backendName, "speculative" to usedSpeculative, "initMs" to if (loaded) 0 else initMs)
        }
      }
    }

    AsyncFunction("generate") Coroutine { o: GenerateOptions ->
      withContext(Dispatchers.Default) {
        lock.withLock {
          val wasLoaded = engine != null && engineKey == "${o.modelPath}|${o.backend == "gpu"}|${o.speculative}"
          val e = engineFor(o.modelPath, o.backend == "gpu", o.speculative)
          val thinking = ThinkingConfig(enableThinking = false)
          val maxOut = o.maxTokens.takeIf { it > 0 }
          val conversation = e.createConversation(ConversationConfig(
            systemInstruction = Contents.of(o.system),
            samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = o.temperature),
            maxOutputToken = maxOut,
            thinkingConfig = thinking,
            enableResponseFormat = o.constrained,
          ))
          active = conversation
          try {
            val parts: List<Content> = o.images.map<String, Content> { Content.ImageBytes(Base64.decode(it, Base64.DEFAULT)) } + Content.Text(o.prompt)
            val format = if (o.constrained) ResponseFormat.json(ANY_JSON_OBJECT) else null
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
              }, maxOutputToken = maxOut, thinkingConfig = thinking, responseFormat = format)
              cont.invokeOnCancellation { conversation.runCatching { cancelProcess() } }
            }
            mapOf(
              "text" to text.toString(),
              "backend" to backendName,
              "speculative" to usedSpeculative,
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
