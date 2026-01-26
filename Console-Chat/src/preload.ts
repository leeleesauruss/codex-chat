import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  listOllamaModels: () => ipcRenderer.invoke('list-ollama-models'),
  fetchApiModels: (config) => ipcRenderer.invoke('fetch-api-models', config),
  
  // Chat streaming
  streamMessage: (payload) => ipcRenderer.send('stream-message', payload),
  /**
   * Subscribe to streaming events; returns an unsubscribe fn for React effects.
   */
  onStreamChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk);
    ipcRenderer.on('stream-chunk', handler);
    return () => ipcRenderer.off('stream-chunk', handler);
  },
  onStreamEnd: (callback: () => void) => {
    const handler = (_event: Electron.IpcRendererEvent) => callback();
    ipcRenderer.on('stream-end', handler);
    return () => ipcRenderer.off('stream-end', handler);
  },
  onStreamError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on('stream-error', handler);
    return () => ipcRenderer.off('stream-error', handler);
  },
});
