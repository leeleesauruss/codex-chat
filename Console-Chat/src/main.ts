import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import Store from 'electron-store';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize electron-store
const store = new Store();

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
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) {
        throw new Error(`Ollama API responded with status ${response.status}`);
      }
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return { error: error.message }; // Send error info to renderer
    }
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
      return { error: error.message };
    }
  });

  // IPC handler for streaming chat
  ipcMain.on('stream-message', async (event, payload) => {
    const { type } = payload;
    
    try {
      if (type === 'api') {
        await handleApiStream(mainWindow, payload.config, payload.messages);
      } else {
        // Default to Ollama
        await handleOllamaStream(mainWindow, payload.model, payload.messages);
      }
    } catch (error) {
       console.error('Stream handler failed:', error);
       mainWindow.webContents.send('stream-error', error.message);
    }
  });

  async function handleOllamaStream(window, model, messages) {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true }),
      });

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Ollama API Error (${response.status}): ${errText}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
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

  async function handleApiStream(window, config, messages) {
      const { baseUrl, apiKey, model } = config;
      const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ model, messages, stream: true })
      });

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API Error ${response.status}: ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
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
