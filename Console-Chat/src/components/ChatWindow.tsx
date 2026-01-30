import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { ChatMessage, RagResult, ImageAttachment } from '../llm/types';
import { Card, Button, Form } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import { shallow } from 'zustand/shallow';

const emptyMessages: ChatMessage[] = [];
const MAX_SNIPPET_CHARS = 400;

const selectCurrentChatId = (state: any) => state.currentChatId;
const selectStreaming = (state: any) => state.streaming;
const selectSelectedModel = (state: any) => state.selectedModel;
const selectOllamaModels = (state: any) => state.ollamaModels;
const selectApiProviders = (state: any) => state.settings.providers;
const selectRag = (state: any) => state.rag;
const selectSetSelectedModel = (state: any) => state.setSelectedModel;
const selectSendMessage = (state: any) => state.sendMessage;
const selectFetchOllamaModels = (state: any) => state.fetchOllamaModels;

export function ChatWindow() {
  const currentChatId = useAppStore(selectCurrentChatId);
  const messages = useAppStore(
    React.useCallback(
      (state) => {
        if (!currentChatId) return emptyMessages;
        return state.chats.find((c: any) => c.id === currentChatId)?.messages ?? emptyMessages;
      },
      [currentChatId],
    ),
    shallow,
  );
  const streaming = useAppStore(selectStreaming);
  const selectedModel = useAppStore(selectSelectedModel);
  const ollamaModels = useAppStore(selectOllamaModels);
  const apiProviders = useAppStore(selectApiProviders);
  const rag = useAppStore(selectRag);
  const setSelectedModel = useAppStore(selectSetSelectedModel);
  const sendMessage = useAppStore(selectSendMessage);
  
  const bottomRef = useRef<null | HTMLDivElement>(null);
  const selectedProvider = apiProviders.find((p) => p.name === selectedModel);
  const engineeredSendLabel = selectedProvider
    ? `Send with ${selectedProvider.name}`
    : selectedModel
      ? `Send with Ollama (${selectedModel})`
      : 'Send';
  const fetchOllamaModels = useAppStore(selectFetchOllamaModels);
  const [refreshingLocalModels, setRefreshingLocalModels] = useState(false);

  useEffect(() => {
    // Scroll to the bottom on new message
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const extractPrompt = (content: string): string | null => {
    const match = content.match(/### Engineered Prompt\n```([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  };

  const handleRun = (prompt: string) => {
    sendMessage(prompt, 'user');
  };

  const handleCopy = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
  };

  const renderSources = (sources?: RagResult[]) => {
    if (!sources || sources.length === 0) return null;
    return (
      <details className="mt-2">
        <SourcesHeader sources={sources} />
        <div className="mt-2 d-flex flex-column gap-2">
          {sources.map((source, idx) => (
            <SourceSnippet key={`${source.sourcePath}-${idx}`} source={source} />
          ))}
        </div>
      </details>
    );
  };

  const renderImages = (images?: ImageAttachment[]) => {
    if (!images || images.length === 0) return null;
    return (
      <div className="d-flex flex-wrap gap-2 mt-2">
        {images.map((img, idx) => (
          <img
            key={`${img.name}-${idx}`}
            src={img.dataUrl || `data:${img.mimeType};base64,${img.data}`}
            alt={img.name}
            style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '6px' }}
          />
        ))}
      </div>
    );
  };

  if (!currentChatId) {
      return (
          <div className="d-flex flex-column h-100 justify-content-center align-items-center text-muted">
              <h4>Welcome to Console-Chat</h4>
              <p>Create a new chat or select one from the sidebar.</p>
          </div>
      );
  }

  return (
    <div className="d-flex flex-column h-100">
      {/* Model Indicator Header */}
      <div className="p-2 chat-model-header border-bottom d-flex align-items-center justify-content-center gap-2 sticky-top">
        <span className="small fw-bold text-muted">Model:</span>
        <Form.Select 
            size="sm" 
            style={{ maxWidth: '250px' }}
            value={selectedModel || ''}
            onChange={(e) => setSelectedModel(e.target.value)}
        >
            <option value="" disabled>Select a Model</option>
            <optgroup label="Ollama (Local)">
                {ollamaModels.length === 0 ? (
                    <option key="no-local" value="" disabled>
                      {refreshingLocalModels ? 'Refreshing local models…' : 'No local models found'}
                    </option>
                ) : (
                    ollamaModels.map(m => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                    ))
                )}
            </optgroup>
            <optgroup label="API Providers">
                {apiProviders.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                ))}
            </optgroup>
        </Form.Select>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={async () => {
            if (refreshingLocalModels) return;
            setRefreshingLocalModels(true);
            try {
              await fetchOllamaModels();
            } finally {
              setRefreshingLocalModels(false);
            }
          }}
          disabled={refreshingLocalModels}
        >
          {refreshingLocalModels ? 'Refreshing…' : 'Refresh Local'}
        </Button>
        <span className={`badge ${rag.enabled ? 'bg-success' : 'bg-secondary'}`}>
          {rag.enabled ? 'RAG On' : 'RAG Off'}
        </span>
      </div>

      <div className="p-3 flex-grow-1" style={{ overflowY: 'auto' }}>
        {messages.map((msg, index) => {
          const engineeredPrompt = msg.role === 'assistant' ? extractPrompt(msg.content) : null;

          return (
            <Card 
                key={index} 
                className={`mb-3 message-card ${msg.role === 'user' ? 'message-user ms-auto' : 'message-assistant'}`}
                style={{ maxWidth: '80%' }}
            >
              <Card.Body>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
                {msg.role === 'user' && renderImages(msg.images)}
                {msg.role === 'assistant' && renderSources(msg.sources)}
              </Card.Body>
              {engineeredPrompt && (
                <Card.Footer className="d-flex justify-content-end gap-2">
                   <Button 
                      variant="outline-secondary" 
                      size="sm" 
                      onClick={() => handleCopy(engineeredPrompt)}
                   >
                     Copy
                   </Button>
                  <Button 
                      variant="success" 
                      size="sm" 
                      onClick={() => handleRun(engineeredPrompt)}
                      disabled={streaming}
                   >
                     {engineeredSendLabel}
                   </Button>
                </Card.Footer>
              )}
            </Card>
          );
        })}
        {streaming && messages[messages.length - 1]?.role === 'assistant' && (
            <div className="spinner-grow spinner-grow-sm" role="status">
            <span className="visually-hidden">Loading...</span>
            </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function SourceSnippet({ source }: { source: RagResult }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = source.content.length > MAX_SNIPPET_CHARS;
  const snippet = expanded || !isLong
    ? source.content
    : `${source.content.slice(0, MAX_SNIPPET_CHARS)}…`;

  return (
    <div className="p-2 border rounded bg-body-tertiary">
      <div className="small fw-bold text-truncate" title={source.sourcePath}>
        {source.sourcePath}
      </div>
      <div className="small text-muted">Score: {source.score.toFixed(3)}</div>
      <pre className="small mb-0" style={{ whiteSpace: 'pre-wrap' }}>
        {snippet}
      </pre>
      {isLong && (
        <button
          type="button"
          className="btn btn-link btn-sm p-0"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function SourcesHeader({ sources }: { sources: RagResult[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopySources = () => {
    const payload = sources
      .map(
        (source, index) =>
          `Source ${index + 1}: ${source.sourcePath}\nScore: ${source.score.toFixed(3)}\n${source.content}`,
      )
      .join('\n\n');
    navigator.clipboard.writeText(payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <summary className="small text-muted d-flex align-items-center gap-2">
      <span>Sources used ({sources.length})</span>
      <button
        type="button"
        className="btn btn-link btn-sm p-0"
        onClick={(e) => {
          e.preventDefault();
          handleCopySources();
        }}
      >
        Copy sources
      </button>
      {copied && <span className="text-success small">Copied</span>}
    </summary>
  );
}
