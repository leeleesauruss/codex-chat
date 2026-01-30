// electron.d.ts
interface RagSourcePayload {
  id?: string;
  path: string;
  type?: 'file' | 'folder';
  addedAt?: number;
}

interface RagIndexInfo {
  count: number;
  indexedAt: number | null;
  embeddingModel: string | null;
}

interface ApiModelEntry {
  id: string;
  [key: string]: unknown;
}

interface ApiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface StreamOptions {
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  seed?: number | null;
  stopSequences?: string[] | null;
}

export interface IElectronAPI {
  getSettings: () => Promise<unknown>;
  saveSettings: (settings: unknown) => Promise<void>;
  listOllamaModels: () => Promise<unknown[] | { error: string }>;
  fetchApiModels: (config: { baseUrl: string; apiKey: string }) => Promise<ApiModelEntry[] | { error: string }>;
  selectRagFiles: () => Promise<string[]>;
  selectRagFolder: () => Promise<string | null>;
  buildRagIndex: (payload: { sources: RagSourcePayload[]; embeddingModel: string }) => Promise<unknown>;
  clearRagIndex: () => Promise<{ count: number; indexedAt: number | null }>;
  getRagIndexInfo: () => Promise<RagIndexInfo>;
  queryRag: (payload: { query: string; topK: number; embeddingModel: string }) => Promise<unknown>;

  // Chat streaming
  streamMessage: (payload: {
    type: 'ollama' | 'api';
    model?: string | null;
    messages: unknown[];
    config?: ApiProviderConfig;
    options?: StreamOptions;
  }) => void;
  onStreamChunk: (callback: (chunk: string) => void) => () => void;
  onStreamEnd: (callback: () => void) => () => void;
  onStreamError: (callback: (error: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
