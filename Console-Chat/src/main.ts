import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import Store from 'electron-store';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize electron-store
const store = new Store();
const RAG_INDEX_KEY = 'ragIndex';

interface RagIndexEntry {
  id: string;
  sourcePath: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
}

interface RagIndex {
  entries: RagIndexEntry[];
  indexedAt: number | null;
  embeddingModel: string | null;
}

interface RagSourcePayload {
  path: string;
  id?: string;
  type?: 'file' | 'folder';
  addedAt?: number;
}

interface RagIndexPayload {
  sources: RagSourcePayload[];
  embeddingModel: string;
}

interface RagQueryPayload {
  query: string;
  topK?: number;
  embeddingModel?: string;
}

interface StreamOptions {
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  seed?: number | null;
  stopSequences?: string[] | null;
}

interface ApiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface StreamMessagePayload {
  type: 'ollama' | 'api';
  model?: string | null;
  messages: unknown[];
  config?: ApiProviderConfig;
  options?: StreamOptions;
}

type PdfParseResult = { text?: string };
type PdfParseFn = (input: Buffer) => Promise<PdfParseResult>;

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });


  // IPC handler to get settings
  ipcMain.handle('get-settings', () => {
    return store.get('settings', {}); // Return default empty object if not set
  });

  // IPC handler to save settings
  ipcMain.handle('save-settings', (event, settings) => {
    store.set('settings', settings);
  });
  
  // IPC handler to list local ollama models
  ipcMain.handle('list-ollama-models', async () => {
    const endpoints = [
      'http://localhost:11434/api/tags',   // documented list endpoint
      'http://localhost:11434/api/models', // fallback for older/newer variants
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          // Try next endpoint on 404; otherwise surface the status.
          if (response.status === 404) continue;
          throw new Error(`Ollama API responded with status ${response.status} for ${url}`);
        }

        const data = await response.json();
        if (Array.isArray(data)) {
          return data;
        }
        if (Array.isArray(data.models)) {
          return data.models;
        }
        if (Array.isArray(data.data)) {
          return data.data;
        }
        // Unexpected shape—continue to next endpoint.
      } catch (error) {
        console.error(`Failed to fetch Ollama models from ${url}:`, error);
        // If this was the last endpoint, report the error; otherwise, keep trying.
        if (url === endpoints[endpoints.length - 1]) {
          return { error: (error as Error).message };
        }
      }
    }

    // If all attempts fail, return an error object.
    return { error: 'Could not retrieve Ollama models from localhost:11434' };
  });

  const allowedExtensions = new Set([
    '.txt',
    '.md',
    '.mdx',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.ini',
    '.xml',
    '.html',
    '.css',
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.py',
    '.pdf',
    '.java',
    '.cs',
    '.cpp',
    '.c',
    '.go',
    '.rs',
    '.sql',
  ]);
  const ignoredFolders = new Set([
    'node_modules',
    '.git',
    '.hg',
    '.svn',
    'dist',
    'build',
    'out',
    '.vite',
  ]);
  const maxFileBytes = 2 * 1024 * 1024; // 2 MB
  const maxChunks = 500;
  const chunkSize = 1000;
  const chunkOverlap = 200;

  const isBinaryBuffer = (buffer: Buffer) => buffer.includes(0);

  const chunkText = (text: string) => {
    const cleaned = text.replace(/\r\n/g, '\n').trim();
    const chunks: string[] = [];
    if (!cleaned) return chunks;
    let start = 0;
    while (start < cleaned.length) {
      const end = Math.min(start + chunkSize, cleaned.length);
      const chunk = cleaned.slice(start, end).trim();
      if (chunk) chunks.push(chunk);
      if (end >= cleaned.length) break;
      start = Math.max(0, end - chunkOverlap);
      if (chunks.length >= maxChunks) break;
    }
    return chunks;
  };

  const collectFiles = async (entryPath: string, results: string[]) => {
    try {
      const stat = await fs.stat(entryPath);
      if (stat.isDirectory()) {
        const dirName = path.basename(entryPath);
        if (ignoredFolders.has(dirName)) return;
        const entries = await fs.readdir(entryPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(entryPath, entry.name);
          if (entry.isDirectory()) {
            if (!ignoredFolders.has(entry.name)) {
              await collectFiles(fullPath, results);
            }
          } else if (entry.isFile()) {
            if (allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
              results.push(fullPath);
            }
          }
        }
      } else if (stat.isFile()) {
        if (allowedExtensions.has(path.extname(entryPath).toLowerCase())) {
          results.push(entryPath);
        }
      }
    } catch (error) {
      console.warn('RAG collectFiles error:', error);
    }
  };

  const fetchOllamaEmbedding = async (model: string, prompt: string) => {
    const response = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama embeddings error (${response.status}): ${errText}`);
    }
    const data = await response.json();
    if (!Array.isArray(data.embedding)) {
      throw new Error('Ollama embeddings response missing embedding array.');
    }
    return data.embedding as number[];
  };

  const cosineSimilarity = (a: number[], b: number[]) => {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  ipcMain.handle('rag-select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Documents',
          extensions: ['txt', 'md', 'json', 'js', 'pdf', 'py', 'yaml', 'yml', 'html'],
        },
      ],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('rag-select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('rag-index-info', () => {
    const existing = store.get(RAG_INDEX_KEY) as RagIndex | undefined;
    if (!existing || !Array.isArray(existing.entries)) {
      return { count: 0, indexedAt: null, embeddingModel: null };
    }
    return {
      count: existing.entries.length,
      indexedAt: existing.indexedAt ?? null,
      embeddingModel: existing.embeddingModel ?? null,
    };
  });

  ipcMain.handle('rag-clear-index', () => {
    store.set(RAG_INDEX_KEY, { entries: [], indexedAt: null, embeddingModel: null } as RagIndex);
    return { count: 0, indexedAt: null };
  });

  ipcMain.handle('rag-index', async (_event, payload) => {
    const { sources, embeddingModel } = (payload || {}) as Partial<RagIndexPayload>;
    if (!embeddingModel) {
      return { error: 'Missing embedding model.' };
    }
    if (!Array.isArray(sources) || sources.length === 0) {
      return { error: 'No sources provided.' };
    }

    const files: string[] = [];
    for (const source of sources) {
      if (!source?.path) continue;
      await collectFiles(source.path, files);
    }

    const entries: RagIndexEntry[] = [];

    for (const filePath of files) {
      if (entries.length >= maxChunks) break;
      try {
        const stat = await fs.stat(filePath);
        if (stat.size > maxFileBytes) continue;
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let text = '';
        if (ext === '.pdf') {
          try {
            const pdfModule = await import('pdf-parse');
            const pdfParse =
              (pdfModule as { default?: PdfParseFn }).default ??
              (pdfModule as unknown as PdfParseFn);
            const parsed = await pdfParse(buffer);
            text = parsed.text || '';
          } catch (error) {
            console.warn('RAG failed to parse PDF:', filePath, error);
            continue;
          }
        } else {
          if (isBinaryBuffer(buffer)) continue;
          text = buffer.toString('utf8');
        }
        const chunks = chunkText(text);
        for (let i = 0; i < chunks.length; i += 1) {
          if (entries.length >= maxChunks) break;
          const chunk = chunks[i];
          const embedding = await fetchOllamaEmbedding(embeddingModel, chunk);
          entries.push({
            id: `${filePath}:${i}`,
            sourcePath: filePath,
            chunkIndex: i,
            content: chunk,
            embedding,
          });
        }
      } catch (error) {
        console.warn('RAG indexing skipped file:', filePath, error);
      }
    }

    const index = {
      entries,
      indexedAt: Date.now(),
      embeddingModel,
    };
    store.set(RAG_INDEX_KEY, index);
    return { count: entries.length, indexedAt: index.indexedAt };
  });

  ipcMain.handle('rag-query', async (_event, payload) => {
    const { query, topK, embeddingModel } = (payload || {}) as Partial<RagQueryPayload>;
    if (!query) {
      return { error: 'Missing query.' };
    }
    const existing = store.get(RAG_INDEX_KEY) as RagIndex | undefined;
    if (!existing || !Array.isArray(existing.entries) || existing.entries.length === 0) {
      return { results: [] };
    }
    if (embeddingModel && existing.embeddingModel && embeddingModel !== existing.embeddingModel) {
      return { error: `Embedding model mismatch (index: ${existing.embeddingModel}).` };
    }
    const modelToUse = embeddingModel || existing.embeddingModel;
    if (!modelToUse) {
      return { error: 'No embedding model available.' };
    }
    const queryEmbedding = await fetchOllamaEmbedding(modelToUse, query);
    const scored = existing.entries.map((entry) => ({
      sourcePath: entry.sourcePath,
      content: entry.content,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
    }));
    const limit = typeof topK === 'number' && topK > 0 ? topK : 5;
    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return { results };
  });

  // IPC handler to fetch models from API providers
  ipcMain.handle('fetch-api-models', async (event, { baseUrl, apiKey }) => {
    try {
      // derive models endpoint from chat completion endpoint
      // e.g., https://api.groq.com/openai/v1/chat/completions -> https://api.groq.com/openai/v1/models
      let modelsUrl = baseUrl.replace('/chat/completions', '/models');
      // If the user provided a base url without /chat/completions, try to guess or use as is if it ends in /v1
      if (!modelsUrl.endsWith('/models')) {
         if (modelsUrl.endsWith('/')) modelsUrl += 'models';
         else modelsUrl += '/models';
      }

      const response = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();
      // Standard OpenAI format: { data: [ { id: '...' }, ... ] }
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch API models:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { error: message };
    }
  });

  // IPC handler for streaming chat
  ipcMain.on('stream-message', async (_event, payload: StreamMessagePayload) => {
    const { type, options } = payload;
    
    try {
      if (type === 'api') {
        if (!payload.config) {
          throw new Error('Missing API config for stream.');
        }
        await handleApiStream(mainWindow, payload.config, payload.messages, options);
      } else {
        // Default to Ollama
        await handleOllamaStream(mainWindow, payload.model, payload.messages, options);
      }
    } catch (error) {
       console.error('Stream handler failed:', error);
       const message = error instanceof Error ? error.message : String(error);
       mainWindow.webContents.send('stream-error', message);
    }
  });

  async function handleOllamaStream(
    window: BrowserWindow,
    model: string | null | undefined,
    messages: unknown[],
    options?: StreamOptions,
  ) {
      if (!model) {
        throw new Error('Missing Ollama model.');
      }
      const ollamaOptions: Record<string, unknown> = {};
      if (options?.temperature !== null && options?.temperature !== undefined) {
        ollamaOptions.temperature = options.temperature;
      }
      if (options?.maxTokens !== null && options?.maxTokens !== undefined) {
        ollamaOptions.num_predict = options.maxTokens;
      }
      if (options?.topP !== null && options?.topP !== undefined) {
        ollamaOptions.top_p = options.topP;
      }
      if (options?.seed !== null && options?.seed !== undefined) {
        ollamaOptions.seed = options.seed;
      }
      if (Array.isArray(options?.stopSequences) && options.stopSequences.length > 0) {
        ollamaOptions.stop = options.stopSequences;
      }
      const payload: { model: string; messages: unknown[]; stream: true; options?: Record<string, unknown> } = {
        model,
        messages,
        stream: true,
      };
      if (Object.keys(ollamaOptions).length > 0) {
        payload.options = ollamaOptions;
      }
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Ollama API Error (${response.status}): ${errText}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Use `for (;;)` instead of `while (true)` to satisfy `no-constant-condition`.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          window.webContents.send('stream-end');
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        chunk.split('\n').filter(line => line).forEach(line => {
            try {
                const parsed = JSON.parse(line);
                if (parsed.done === false && parsed.message?.content) {
                    window.webContents.send('stream-chunk', parsed.message.content);
                }
            } catch (e) { /* ignore parse errors for partial chunks */ }
        });
      }
  }

  async function handleApiStream(
    window: BrowserWindow,
    config: ApiProviderConfig,
    messages: unknown[],
    options?: StreamOptions,
  ) {
      const { baseUrl, apiKey, model } = config;
      const payload: {
        model: string;
        messages: unknown[];
        stream: true;
        temperature?: number;
        max_tokens?: number;
        top_p?: number;
        seed?: number;
        stop?: string[];
      } = { model, messages, stream: true };
      if (options?.temperature !== null && options?.temperature !== undefined) {
        payload.temperature = options.temperature;
      }
      if (options?.maxTokens !== null && options?.maxTokens !== undefined) {
        payload.max_tokens = options.maxTokens;
      }
      if (options?.topP !== null && options?.topP !== undefined) {
        payload.top_p = options.topP;
      }
      if (options?.seed !== null && options?.seed !== undefined) {
        payload.seed = options.seed;
      }
      if (Array.isArray(options?.stopSequences) && options.stopSequences.length > 0) {
        payload.stop = options.stopSequences;
      }
      const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
      });

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API Error ${response.status}: ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Use `for (;;)` instead of `while (true)` to satisfy `no-constant-condition`.
      for (;;) {
          const { done, value } = await reader.read();
          if (done) {
              window.webContents.send('stream-end');
              break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep the last line in the buffer as it might be incomplete
          buffer = lines.pop() || '';

          for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                  const data = trimmed.slice(6);
                  if (data === '[DONE]') continue;
                  try {
                      const parsed = JSON.parse(data);
                      const content = parsed.choices?.[0]?.delta?.content;
                      if (content) {
                          window.webContents.send('stream-chunk', content);
                      }
                  } catch (e) { /* ignore json parse errors */ }
              }
          }
      }
  }

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
