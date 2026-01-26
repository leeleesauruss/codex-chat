import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { OptimizationModal } from './components/OptimizationModal';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { ThemeBrowserModal } from './components/ThemeBrowserModal';
import { useAppStore } from './store';

const themeCssCache = new Map<string, string>();

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showOptimization, setShowOptimization] = useState(false);
  const [showThemeBrowser, setShowThemeBrowser] = useState(false);
  // Subscribe only to theme changes; avoid re-rendering App for every streaming chunk.
  const themeMode = useAppStore((state) => state.themeMode);
  const selectedTheme = useAppStore((state) => state.selectedTheme);
  const themeStyleRef = useRef<HTMLStyleElement | null>(null);

  // Load persisted settings and wire stream listeners once.
  useEffect(() => {
    useAppStore.getState().loadSettings();

    const offChunk = window.electronAPI.onStreamChunk((chunk) => {
      useAppStore.getState().appendLastMessage(chunk);
    });
    const offEnd = window.electronAPI.onStreamEnd(() => useAppStore.getState().setStreaming(false));
    const offError = window.electronAPI.onStreamError((error) => {
      console.error('Stream Error:', error);
      useAppStore.getState().appendLastMessage(`\n**Error:** ${error}`);
      useAppStore.getState().setStreaming(false);
    });

    return () => {
      if (typeof offChunk === 'function') offChunk();
      if (typeof offEnd === 'function') offEnd();
      if (typeof offError === 'function') offError();
    };
  }, []);

  // React to theme changes without re-loading settings.
  useEffect(() => {
    const themeSource = selectedTheme ? 'obsidian' : 'builtin';
    document.documentElement.setAttribute('data-bs-theme', themeMode === 'dark' ? 'dark' : 'light');
    document.documentElement.dataset.themeMode = themeMode;
    document.documentElement.dataset.themeName = selectedTheme?.slug ?? 'ui-default';
    document.documentElement.dataset.themeSource = themeSource;
    document.body.dataset.themeMode = themeMode;
    document.body.dataset.themeName = selectedTheme?.slug ?? 'ui-default';
    document.body.dataset.themeSource = themeSource;

    // Many Obsidian themes scope variables under `.theme-dark` / `.theme-light`.
    // Mirror those classes so the injected `obsidian.css` can actually affect our UI.
    const root = document.documentElement;
    root.classList.toggle('theme-dark', themeMode === 'dark');
    root.classList.toggle('theme-light', themeMode === 'light');
    document.body.classList.toggle('theme-dark', themeMode === 'dark');
    document.body.classList.toggle('theme-light', themeMode === 'light');
  }, [themeMode, selectedTheme]);

  // Dynamically load Obsidian community CSS when a catalog theme is selected.
  useEffect(() => {
    if (!selectedTheme) {
      themeStyleRef.current?.remove();
      themeStyleRef.current = null;
      return;
    }

    const key = `${selectedTheme.repo}|${selectedTheme.mode}`;
    const ensureStyleEl = () => {
      if (themeStyleRef.current) return themeStyleRef.current;
      const style = document.createElement('style');
      style.dataset.source = 'obsidian-theme';
      document.head.appendChild(style);
      themeStyleRef.current = style;
      return style;
    };

    const applyCss = (css: string) => {
      const styleEl = ensureStyleEl();
      styleEl.textContent = `/* Obsidian theme: ${selectedTheme.name || selectedTheme.repo} (${selectedTheme.mode}) */\n${css}`;
    };

    const cached = themeCssCache.get(key);
    if (cached) {
      applyCss(cached);
      return;
    }

    let cancelled = false;
    const candidates = [
      `https://raw.githubusercontent.com/${selectedTheme.repo}/HEAD/obsidian.css`,
      `https://raw.githubusercontent.com/${selectedTheme.repo}/main/obsidian.css`,
      `https://raw.githubusercontent.com/${selectedTheme.repo}/master/obsidian.css`,
    ];

    (async () => {
      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const css = await res.text();
          if (cancelled) return;
          themeCssCache.set(key, css);
          applyCss(css);
          return;
        } catch (err) {
          console.warn('Theme fetch failed', url, err);
        }
      }
      if (!cancelled) {
        applyCss(':root{--obsidian-theme:failed;}');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTheme]);

  return (
    <>
      <Container fluid className="app-shell d-flex flex-column">
        {/* Header */}
        <Row as="header" className="app-header shadow-sm flex-shrink-0">
          <Col>
            <h1 className="text-center p-2">Console-Chat</h1>
          </Col>
        </Row>

        <Row className="flex-grow-1 app-content">
          {/* Sidebar */}
          <Col md={3} as="aside" className="app-sidebar" style={{ overflowY: 'auto' }}>
            <Sidebar 
              onShowSettings={() => setShowSettings(true)} 
              onShowOptimization={() => setShowOptimization(true)}
              onShowThemeBrowser={() => setShowThemeBrowser(true)}
            />
          </Col>

          {/* Main Chat Area */}
          <Col 
            md={9} 
            as="main" 
            className="app-main d-flex flex-column"
            style={{ overflowY: 'auto', height: 'calc(100vh - 56px)' }}
          >
            <ChatWindow />
            <ChatInput />
          </Col>
        </Row>
      </Container>

      <SettingsModal show={showSettings} onHide={() => setShowSettings(false)} />
      <OptimizationModal show={showOptimization} onHide={() => setShowOptimization(false)} />
      <ThemeBrowserModal show={showThemeBrowser} onHide={() => setShowThemeBrowser(false)} />
    </>
  );
}

export default App;
