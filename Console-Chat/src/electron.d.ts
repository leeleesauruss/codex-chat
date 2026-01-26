// electron.d.ts
export interface IElectronAPI {
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<void>;
  listOllamaModels: () => Promise<any[] | { error: string }>;
  fetchApiModels: (config: any) => Promise<any>;

  // Chat streaming
  streamMessage: (payload: { type: 'ollama' | 'api'; model?: string; messages: any[]; config?: any }) => void;
  onStreamChunk: (callback: (chunk: string) => void) => () => void;
  onStreamEnd: (callback: () => void) => () => void;
  onStreamError: (callback: (error: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
