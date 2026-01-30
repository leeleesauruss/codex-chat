import {create} from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ChatSession, Folder, ChatMessage, RagResult, ImageAttachment, ChatSettings } from './llm/types';
import { v4 as uuidv4 } from 'uuid';

export type ThemeMode = 'light' | 'dark';

export interface ThemeCatalogEntry {
  name: string;
  author?: string;
  repo: string;
  screenshot?: string;
  modes: ThemeMode[];
  legacy?: boolean;
  publish?: boolean;
}

export interface SelectedTheme {
  name: string;
  author?: string;
  repo: string;
  mode: ThemeMode;
  modes: ThemeMode[];
  slug: string;
}

const slugify = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '') || 'custom';

// Define the shape of the settings for API providers
export interface ApiProvider {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  modelId: string;
}

// Define the shape of the Ollama model
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export interface RagSource {
  id: string;
  path: string;
  type: 'file' | 'folder';
  addedAt: number;
}

export interface RagSettings {
  enabled: boolean;
  embeddingModel: string;
  topK: number;
  sources: RagSource[];
  indexedCount: number;
  lastIndexedAt: number | null;
}

const defaultChatSettings: ChatSettings = {
  systemPrompt: '',
  temperature: null,
  maxTokens: null,
  topP: null,
  seed: null,
  stopSequences: [],
  modelOverride: null,
};

export interface AppState {
  settings: {
    providers: ApiProvider[];
  };
  ollamaModels: OllamaModel[];
  rag: RagSettings;
  folders: Folder[];
  chats: ChatSession[];
  currentChatId: string | null;
  streaming: boolean;
  selectedModel: string | null;
  themeMode: ThemeMode;
  selectedTheme: SelectedTheme | null;
  fetchOllamaModels: () => Promise<void>;
  updateProvider: (provider: ApiProvider) => void;
  addProvider: (provider: ApiProvider) => void;
  removeProvider: (id: string) => void;
  loadSettings: () => Promise<void>;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  applyCatalogTheme: (theme: ThemeCatalogEntry, preferredMode?: ThemeMode) => void;
  clearSelectedTheme: () => void;
  createFolder: (name: string) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  createChat: (title?: string, folderId?: string | null) => string;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  moveChat: (chatId: string, folderId: string | null) => void;
  selectChat: (id: string) => void;
  sendMessage: (content: string, role?: 'user' | 'assistant', images?: ImageAttachment[]) => Promise<void>;
  addMessage: (message: ChatMessage) => void;
  appendLastMessage: (chunk: string) => void;
  setSelectedModel: (model: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  updateChatSettings: (chatId: string, settings: Partial<ChatSettings>) => void;
  saveState: () => void;
  setRagEnabled: (enabled: boolean) => void;
  setRagEmbeddingModel: (model: string) => void;
  setRagTopK: (topK: number) => void;
  addRagSources: (sources: RagSource[]) => void;
  removeRagSource: (id: string) => void;
  clearRagSources: () => void;
  refreshRagIndexInfo: () => Promise<void>;
  indexRagSources: () => Promise<{ count: number; indexedAt: number | null } | { error: string }>;
}

export const useAppStore = create<AppState>()(
  immer((set, get) => {
    const persist = () => {
      const { settings, themeMode, selectedTheme, folders, chats, rag } = get();
      window.electronAPI.saveSettings({
        settings,
        theme: {
          mode: themeMode,
          selectedTheme,
        },
        rag,
        folders,
        chats,
      });
    };

    return {
      settings: { providers: [] },
      ollamaModels: [],
      rag: {
        enabled: false,
        embeddingModel: 'nomic-embed-text',
        topK: 5,
        sources: [],
        indexedCount: 0,
        lastIndexedAt: null,
      },
      folders: [],
      chats: [],
      currentChatId: null,
      streaming: false,
      selectedModel: null,
      themeMode: 'dark',
      selectedTheme: null,

      loadSettings: async () => {
        const data = await window.electronAPI.getSettings();
        set((state) => {
          state.settings = data.settings || { providers: [] };
          if (data.rag) {
            state.rag = {
              enabled: data.rag.enabled ?? state.rag.enabled,
              embeddingModel: data.rag.embeddingModel || state.rag.embeddingModel,
              topK: data.rag.topK || state.rag.topK,
              sources: Array.isArray(data.rag.sources) ? data.rag.sources : state.rag.sources,
              indexedCount: data.rag.indexedCount ?? state.rag.indexedCount,
              lastIndexedAt: data.rag.lastIndexedAt ?? state.rag.lastIndexedAt,
            };
          }

          const storedTheme = data.theme;
          if (typeof storedTheme === 'string') {
            state.themeMode = storedTheme === 'dark' ? 'dark' : 'light';
            state.selectedTheme = null;
          } else if (storedTheme) {
            state.themeMode = storedTheme.mode === 'dark' ? 'dark' : 'light';
            if (storedTheme.selectedTheme) {
              state.selectedTheme = {
                ...storedTheme.selectedTheme,
                mode: storedTheme.selectedTheme.mode === 'dark' ? 'dark' : 'light',
                modes:
                  storedTheme.selectedTheme.modes?.length
                    ? storedTheme.selectedTheme.modes
                    : [state.themeMode],
                slug:
                  storedTheme.selectedTheme.slug ||
                  slugify(storedTheme.selectedTheme.name || storedTheme.selectedTheme.repo),
              };
            } else {
              state.selectedTheme = null;
            }
          } else {
            state.themeMode = 'dark';
            state.selectedTheme = null;
          }

          state.folders = data.folders || [];
          state.chats = (data.chats || []).map((chat: ChatSession) => ({
            ...chat,
            settings: {
              ...defaultChatSettings,
              ...(chat.settings || {}),
            },
          }));
          if (state.chats.length > 0 && !state.currentChatId) {
            state.currentChatId = state.chats.sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
          }
        });
      },

      saveState: () => persist(),

      toggleTheme: () => {
        set((state) => {
          const nextMode = state.themeMode === 'light' ? 'dark' : 'light';
          state.themeMode = nextMode;
          if (state.selectedTheme) {
            if (state.selectedTheme.modes.includes(nextMode)) {
              state.selectedTheme.mode = nextMode;
            } else {
              state.selectedTheme = null;
            }
          }
        });
        persist();
      },

      setThemeMode: (mode) => {
        set((state) => {
          state.themeMode = mode;
          if (state.selectedTheme) {
            if (state.selectedTheme.modes.includes(mode)) {
              state.selectedTheme.mode = mode;
            } else {
              state.selectedTheme = null;
            }
          }
        });
        persist();
      },

      applyCatalogTheme: (theme, preferredMode) => {
        const currentMode = get().themeMode;
        const uniqueModes = Array.from(new Set(theme.modes));
        const targetMode: ThemeMode =
          preferredMode ??
          (uniqueModes.includes(currentMode)
            ? currentMode
            : uniqueModes.includes('dark')
            ? 'dark'
            : 'light');
        set((state) => {
          state.themeMode = targetMode;
          state.selectedTheme = {
            name: theme.name,
            author: theme.author,
            repo: theme.repo,
            mode: targetMode,
            modes: uniqueModes,
            slug: slugify(theme.name || theme.repo),
          };
        });
        persist();
      },

      clearSelectedTheme: () => {
        set((state) => {
          state.selectedTheme = null;
        });
        persist();
      },

      fetchOllamaModels: async () => {
        const result = await window.electronAPI.listOllamaModels();
        if ('error' in result) {
          console.error('Failed to fetch Ollama models:', result.error);
          set({ ollamaModels: [] });
        } else {
          set({ ollamaModels: result });
          if (!get().selectedModel && result.length > 0) {
            set({ selectedModel: result[0].name });
          }
        }
      },

      setRagEnabled: (enabled) => {
        set((state) => {
          state.rag.enabled = enabled;
        });
        persist();
      },

      setRagEmbeddingModel: (model) => {
        set((state) => {
          state.rag.embeddingModel = model;
        });
        persist();
      },

      setRagTopK: (topK) => {
        set((state) => {
          state.rag.topK = topK;
        });
        persist();
      },

      addRagSources: (sources) => {
        set((state) => {
          const existing = new Set(state.rag.sources.map((s) => s.path));
          sources.forEach((source) => {
            if (!existing.has(source.path)) {
              state.rag.sources.push(source);
              existing.add(source.path);
            }
          });
        });
        persist();
      },

      removeRagSource: (id) => {
        set((state) => {
          state.rag.sources = state.rag.sources.filter((s) => s.id !== id);
        });
        persist();
      },

      clearRagSources: () => {
        set((state) => {
          state.rag.sources = [];
        });
        persist();
      },

      refreshRagIndexInfo: async () => {
        const info = await window.electronAPI.getRagIndexInfo();
        set((state) => {
          state.rag.indexedCount = info.count || 0;
          state.rag.lastIndexedAt = info.indexedAt || null;
          if (info.embeddingModel) {
            state.rag.embeddingModel = info.embeddingModel;
          }
        });
      },

      indexRagSources: async () => {
        const { rag } = get();
        const result = await window.electronAPI.buildRagIndex({
          sources: rag.sources,
          embeddingModel: rag.embeddingModel,
        });
        if ('error' in result) {
          return result;
        }
        set((state) => {
          state.rag.indexedCount = result.count || 0;
          state.rag.lastIndexedAt = result.indexedAt || null;
        });
        persist();
        return result;
      },

      updateProvider: (provider) => {
        set((state) => {
          const index = state.settings.providers.findIndex((p) => p.id === provider.id);
          if (index !== -1) {
            state.settings.providers[index] = provider;
          } else {
            state.settings.providers.push(provider);
          }
        });
        persist();
      },

      addProvider: (provider) => {
        set((state) => {
          state.settings.providers.push(provider);
        });
        persist();
      },

      removeProvider: (id) => {
        set((state) => {
          state.settings.providers = state.settings.providers.filter((p) => p.id !== id);
        });
        persist();
      },

      createFolder: (name) => {
        set((state) => {
          state.folders.push({
            id: uuidv4(),
            name,
            parentId: null,
            createdAt: Date.now(),
          });
        });
        persist();
      },

      renameFolder: (id, name) => {
        set((state) => {
          const folder = state.folders.find((f) => f.id === id);
          if (folder) folder.name = name;
        });
        persist();
      },

      deleteFolder: (id) => {
        set((state) => {
          state.folders = state.folders.filter((f) => f.id !== id);
          state.chats.forEach((chat) => {
            if (chat.folderId === id) {
              chat.folderId = null;
            }
          });
        });
        persist();
      },

      createChat: (title = 'New Chat', folderId = null) => {
        const newId = uuidv4();
        set((state) => {
          state.chats.push({
            id: newId,
            title,
            folderId,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            modelUsed: state.selectedModel || undefined,
            settings: { ...defaultChatSettings },
          });
          state.currentChatId = newId;
        });
        persist();
        return newId;
      },

      deleteChat: (id) => {
        set((state) => {
          state.chats = state.chats.filter((c) => c.id !== id);
          if (state.currentChatId === id) {
            state.currentChatId = null;
          }
        });
        persist();
      },

      renameChat: (id, title) => {
        set((state) => {
          const chat = state.chats.find((c) => c.id === id);
          if (chat) chat.title = title;
        });
        persist();
      },

      moveChat: (chatId, folderId) => {
        set((state) => {
          const chat = state.chats.find((c) => c.id === chatId);
          if (chat) chat.folderId = folderId;
        });
        persist();
      },

      selectChat: (id) => {
        set({ currentChatId: id });
      },

      sendMessage: async (content, role = 'user', images = []) => {
        const { selectedModel, chats, currentChatId, settings } = get();
        let targetChatId = currentChatId;
        const activeChat = chats.find((c) => c.id === targetChatId);
        const chatSettings = activeChat?.settings || defaultChatSettings;
        const modelToUse = chatSettings.modelOverride || selectedModel;

        if (!targetChatId) {
          const newId = uuidv4();
          set((state) => {
            state.chats.push({
              id: newId,
              title: content.substring(0, 30) || 'New Chat',
              folderId: null,
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              modelUsed: selectedModel || undefined,
            });
            state.currentChatId = newId;
          });
          targetChatId = newId;
        }

        const newMessage: ChatMessage = {
          role,
          content,
          timestamp: Date.now(),
          ...(images.length ? { images } : {}),
        };

        set((state) => {
          const chat = state.chats.find((c) => c.id === targetChatId);
          if (chat) {
            chat.messages.push(newMessage);
            chat.updatedAt = Date.now();
          }
          state.streaming = true;
        });

        if (role === 'user') {
          set((state) => {
            const chat = state.chats.find((c) => c.id === targetChatId);
            if (chat) {
              chat.messages.push({ role: 'assistant', content: '', timestamp: Date.now() });
            }
          });

          const apiProvider = settings.providers.find((p) => p.name === modelToUse);
          const currentMessages = get().chats.find((c) => c.id === targetChatId)?.messages || [];
          const historyToSend = currentMessages.slice(0, -1);
          const rag = get().rag;
          let ragContext: string | null = null;
          let ragResults: RagResult[] = [];
          const systemPrompt = chatSettings.systemPrompt?.trim() || null;
          const temperature = chatSettings.temperature;
          const maxTokens = chatSettings.maxTokens;
          const topP = chatSettings.topP;
          const seed = chatSettings.seed;
          const stopSequences =
            Array.isArray(chatSettings.stopSequences) && chatSettings.stopSequences.length > 0
              ? chatSettings.stopSequences
              : null;

          if (rag.enabled && rag.sources.length > 0) {
            try {
              const result = await window.electronAPI.queryRag({
                query: content,
                topK: rag.topK,
                embeddingModel: rag.embeddingModel,
              });
              if (!('error' in result) && Array.isArray(result.results) && result.results.length > 0) {
                ragResults = result.results as RagResult[];
                const snippets = ragResults
                  .map((item, index) => `Source ${index + 1}: ${item.sourcePath}\n${item.content}`)
                  .join('\n\n');
                ragContext = `Use the following context snippets when answering. If relevant, cite the source paths.\n\n${snippets}`;
              } else if ('error' in result) {
                console.warn('RAG query error:', result.error);
              }
            } catch (error) {
              console.warn('RAG query failed:', error);
            }
          }

          if (ragResults.length > 0) {
            set((state) => {
              const chat = state.chats.find((c) => c.id === targetChatId);
              if (chat) {
                const lastMsg = chat.messages[chat.messages.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.sources = ragResults;
                }
              }
            });
          }

          const systemMessages: ChatMessage[] = [];
          if (systemPrompt) {
            systemMessages.push({ role: 'system', content: systemPrompt, timestamp: Date.now() });
          }
          if (ragContext) {
            systemMessages.push({ role: 'system', content: ragContext, timestamp: Date.now() });
          }
          const baseMessages = systemMessages.length > 0
            ? [...systemMessages, ...historyToSend]
            : historyToSend;

          const toOllamaMessages = (messages: ChatMessage[]) =>
            messages.map((m) => ({
              role: m.role,
              content: m.content,
              ...(m.images?.length
                ? { images: m.images.map((img) => img.data) }
                : {}),
            }));

          const toApiMessages = (messages: ChatMessage[]) =>
            messages.map((m) => {
              if (m.images && m.images.length > 0) {
                const parts = [];
                if (m.content?.trim()) {
                  parts.push({ type: 'text', text: m.content });
                }
                m.images.forEach((img) => {
                  const url = img.dataUrl || `data:${img.mimeType};base64,${img.data}`;
                  parts.push({ type: 'image_url', image_url: { url } });
                });
                return { role: m.role, content: parts };
              }
              return { role: m.role, content: m.content };
            });

          if (apiProvider) {
            window.electronAPI.streamMessage({
              type: 'api',
              config: { baseUrl: apiProvider.baseUrl, apiKey: apiProvider.apiKey, model: apiProvider.modelId },
              options: { temperature, maxTokens, topP, seed, stopSequences },
              messages: toApiMessages(baseMessages),
            });
          } else {
            window.electronAPI.streamMessage({
              type: 'ollama',
              model: modelToUse,
              options: { temperature, maxTokens, topP, seed, stopSequences },
              messages: toOllamaMessages(baseMessages),
            });
          }
        }

        persist();
      },

      addMessage: (message) => {
        get().sendMessage(message.content, message.role, message.images);
      },

      appendLastMessage: (chunk) => {
        set((state) => {
          const chat = state.chats.find((c) => c.id === state.currentChatId);
          if (chat) {
            const lastMsg = chat.messages[chat.messages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content += chunk;
            }
          }
        });
      },

      setSelectedModel: (model) => {
        set({ selectedModel: model });
      },

      setStreaming: (isStreaming) => {
        set((state) => {
          state.streaming = isStreaming;
        });
        if (!isStreaming) {
          persist();
        }
      },

      updateChatSettings: (chatId, settingsUpdate) => {
        set((state) => {
          const chat = state.chats.find((c) => c.id === chatId);
          if (chat) {
            chat.settings = {
              ...defaultChatSettings,
              ...(chat.settings || {}),
              ...settingsUpdate,
            };
          }
        });
        persist();
      },
    } as AppState;
  }),
);
