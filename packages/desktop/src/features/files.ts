import { BrowserWindow, dialog, ipcMain } from "electron";
import { readFile, writeFile } from "node:fs/promises";

interface FileFilter {
  name: string;
  extensions: string[];
}

interface SaveTextOptions {
  title?: string;
  defaultFileName?: string;
  content: string;
  filters?: FileFilter[];
}

interface OpenTextOptions {
  title?: string;
  filters?: FileFilter[];
}

export interface OpenedTextFile {
  path: string;
  content: string;
}

/**
 * Native save/open dialogs for plain-text files. Used by Settings to move the
 * host list between machines as a real file (AirDrop, iCloud Drive) instead of
 * the clipboard. Returns null when the user cancels.
 */
export function registerFileHandlers(): void {
  ipcMain.handle("paseo:file:saveText", async (event, options: SaveTextOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const dialogOptions: Electron.SaveDialogOptions = {
      title: options.title,
      defaultPath: options.defaultFileName,
      filters: options.filters,
    };
    const result = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);
    if (result.canceled || !result.filePath) {
      return null;
    }
    await writeFile(result.filePath, options.content, "utf8");
    return result.filePath;
  });

  ipcMain.handle(
    "paseo:file:openText",
    async (event, options?: OpenTextOptions): Promise<OpenedTextFile | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions: Electron.OpenDialogOptions = {
        title: options?.title,
        filters: options?.filters,
        properties: ["openFile"],
      };
      const result = win
        ? await dialog.showOpenDialog(win, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      const path = result.filePaths[0];
      const content = await readFile(path, "utf8");
      return { path, content };
    },
  );
}
