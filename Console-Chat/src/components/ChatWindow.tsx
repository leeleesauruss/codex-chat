import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { ChatMessage } from '../llm/types';
import { Card, Button, Form } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import { shallow } from 'zustand/shallow';

const emptyMessages: ChatMessage[] = [];

const selectCurrentChatId = (state: any) => state.currentChatId;
const selectStreaming = (state: any) => state.streaming;
const selectSelectedModel = (state: any) => state.selectedModel;
const selectOllamaModels = (state: any) => state.ollamaModels;
const selectApiProviders = (state: any) => state.settings.providers;
const selectSetSelectedModel = (state: any) => state.setSelectedModel;
const selectSendMessage = (state: any) => state.sendMessage;

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
  const setSelectedModel = useAppStore(selectSetSelectedModel);
  const sendMessage = useAppStore(selectSendMessage);
  
  const bottomRef = useRef<null | HTMLDivElement>(null);
  const selectedProvider = apiProviders.find((p) => p.name === selectedModel);
  const engineeredSendLabel = selectedProvider
    ? `Send with ${selectedProvider.name}`
    : selectedModel
      ? `Send with Ollama (${selectedModel})`
      : 'Send';

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
                {ollamaModels.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                ))}
            </optgroup>
            <optgroup label="API Providers">
                {apiProviders.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                ))}
            </optgroup>
        </Form.Select>
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
