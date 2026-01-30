import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  listOllamaModels: () => ipcRenderer.invoke('list-ollama-models'),
  fetchApiModels: (config) => ipcRenderer.invoke('fetch-api-models', config),
  selectRagFiles: () => ipcRenderer.invoke('rag-select-files'),
  selectRagFolder: () => ipcRenderer.invoke('rag-select-folder'),
  buildRagIndex: (payload) => ipcRenderer.invoke('rag-index', payload),
  clearRagIndex: () => ipcRenderer.invoke('rag-clear-index'),
  getRagIndexInfo: () => ipcRenderer.invoke('rag-index-info'),
  queryRag: (payload) => ipcRenderer.invoke('rag-query', payload),
  
  // Chat streaming
  streamMessage: (payload) => ipcRenderer.send('stream-message', payload),
  /**
   * Subscribe to streaming events; returns an unsubscribe fn for React effects.
   */
  onStreamChunk: (callback: (chunk: string) => void) => {
    const handler = (event: Electron.IpcRendererEvent, chunk: string) => {
      void event;
      callback(chunk);
    };
    ipcRenderer.on('stream-chunk', handler);
    return () => ipcRenderer.off('stream-chunk', handler);
  },
  onStreamEnd: (callback: () => void) => {
    const handler = (event: Electron.IpcRendererEvent) => {
      void event;
      callback();
    };
    ipcRenderer.on('stream-end', handler);
    return () => ipcRenderer.off('stream-end', handler);
  },
  onStreamError: (callback: (error: string) => void) => {
    const handler = (event: Electron.IpcRendererEvent, error: string) => {
      void event;
      callback(error);
    };
    ipcRenderer.on('stream-error', handler);
    return () => ipcRenderer.off('stream-error', handler);
  },
});
