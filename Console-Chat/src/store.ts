import {create} from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ChatSession, Folder, ChatMessage } from './llm/types';
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

interface AppState {
  settings: {
    providers: ApiProvider[];
  };
  ollamaModels: OllamaModel[];
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
  sendMessage: (content: string, role?: 'user' | 'assistant') => void;
  addMessage: (message: ChatMessage) => void;
  appendLastMessage: (chunk: string) => void;
  setSelectedModel: (model: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  saveState: () => void;
}

export const useAppStore = create<AppState>()(
  immer((set, get) => {
    const persist = () => {
      const { settings, themeMode, selectedTheme, folders, chats } = get();
      window.electronAPI.saveSettings({
        settings,
        theme: {
          mode: themeMode,
          selectedTheme,
        },
        folders,
        chats,
      });
    };

    return {
      settings: { providers: [] },
      ollamaModels: [],
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
          state.chats = data.chats || [];
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

      sendMessage: (content, role = 'user') => {
        const { selectedModel, chats, currentChatId, settings } = get();
        let targetChatId = currentChatId;

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

          const apiProvider = settings.providers.find((p) => p.name === selectedModel);
          const currentMessages = get().chats.find((c) => c.id === targetChatId)?.messages || [];
          const historyToSend = currentMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

          if (apiProvider) {
            window.electronAPI.streamMessage({
              type: 'api',
              config: { baseUrl: apiProvider.baseUrl, apiKey: apiProvider.apiKey, model: apiProvider.modelId },
              messages: historyToSend,
            });
          } else {
            window.electronAPI.streamMessage({
              type: 'ollama',
              model: selectedModel,
              messages: historyToSend,
            });
          }
        }

        persist();
      },

      addMessage: (message) => {
        get().sendMessage(message.content, message.role);
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
    } as AppState;
  }),
);
