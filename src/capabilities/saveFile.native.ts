import { Directory } from 'expo-file-system';

/** Asks for a folder, then writes the file there. Returns false when the user cancels the picker. */
export async function saveFile(name: string, text: string): Promise<boolean> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return false;
  }
  dir.createFile(name, 'application/json').write(text);
  return true;
}
