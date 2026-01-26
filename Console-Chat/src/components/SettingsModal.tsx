// src/components/SettingsModal.tsx
import React, { useState } from 'react';
import { Modal, Button, Form, ListGroup, Stack } from 'react-bootstrap';
import { useAppStore } from '../store';
import {v4 as uuidv4} from 'uuid';

interface SettingsModalProps {
  show: boolean;
  onHide: () => void;
}

const PRESETS = {
  custom: { name: 'Custom', baseUrl: '', modelId: '' },
  mistral: { name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1/chat/completions', modelId: 'mistral-tiny' },
  groq: { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', modelId: 'llama3-8b-8192' },
  openrouter: { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1/chat/completions', modelId: 'openai/gpt-3.5-turbo' },
};

export function SettingsModal({ show, onHide }: SettingsModalProps) {
  const { settings, addProvider, removeProvider } = useAppStore();
  
  const [selectedPreset, setSelectedPreset] = useState('custom');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [availableModels, setAvailableModels] = useState<{id: string}[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelFilter, setModelFilter] = useState('');

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setSelectedPreset(key);
    const preset = PRESETS[key as keyof typeof PRESETS];
    if (key !== 'custom') {
      setName(preset.name);
      setBaseUrl(preset.baseUrl);
      setModelId(preset.modelId);
    }
    setAvailableModels([]); // Reset models on preset change
  };

  const handleFetchModels = async () => {
    if (!baseUrl || !apiKey) return;
    setFetchingModels(true);
    setAvailableModels([]);
    try {
        const models = await window.electronAPI.fetchApiModels({ baseUrl, apiKey });
        if (Array.isArray(models)) {
            setAvailableModels(models);
        } else {
            console.error("Failed to fetch models", models);
            alert("Failed to fetch models. Check console for details.");
        }
    } catch (e) {
        console.error(e);
        alert("Error fetching models: " + e);
    } finally {
        setFetchingModels(false);
    }
  };

  const handleAddProvider = () => {
    console.log("Adding provider:", { name, apiKey, baseUrl, modelId });
    if (name && apiKey && baseUrl && modelId) {
        const newProvider = { 
          id: uuidv4(), 
          name, 
          apiKey, 
          baseUrl, 
          modelId 
        };
        console.log("Constructed provider:", newProvider);
        addProvider(newProvider);
      // Reset form
      setSelectedPreset('custom');
      setName('');
      setApiKey('');
      setBaseUrl('');
      setModelId('');
      setAvailableModels([]);
    } else {
        console.error("Missing fields:", { name, apiKey, baseUrl, modelId });
    }
  };

  const filteredModels = availableModels.filter(m => 
    m.id.toLowerCase().includes(modelFilter.toLowerCase())
  );

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>API Provider Settings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h5>Configured Providers</h5>
        <ListGroup className="mb-4">
          {settings.providers.length === 0 && <p className="text-muted">No providers configured.</p>}
          {settings.providers.map((provider) => (
            <ListGroup.Item key={provider.id}>
              <Stack direction="horizontal" gap={3}>
                <div>
                  <strong>{provider.name}</strong> <span className="text-muted">({provider.modelId})</span>
                </div>
                <div className="ms-auto small text-muted">
                    {provider.baseUrl.substring(0, 25)}...
                </div>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => removeProvider(provider.id)}
                >
                  Remove
                </Button>
              </Stack>
            </ListGroup.Item>
          ))}
        </ListGroup>
        
        <hr />
        <h5>Add New Provider</h5>
        <Form>
           <Form.Group className="mb-3">
            <Form.Label>Preset</Form.Label>
            <Form.Select value={selectedPreset} onChange={handlePresetChange}>
              <option value="custom">Custom (OpenAI Compatible)</option>
              <option value="mistral">Mistral AI</option>
              <option value="groq">Groq</option>
              <option value="openrouter">OpenRouter</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Display Name</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Mistral"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Base URL (Chat Completions Endpoint)</Form.Label>
            <Form.Control
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1/chat/completions"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>API Key</Form.Label>
            <Stack direction="horizontal" gap={2}>
                <Form.Control
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                />
                <Button 
                    variant="outline-secondary" 
                    onClick={handleFetchModels}
                    disabled={!apiKey || !baseUrl || fetchingModels}
                >
                    {fetchingModels ? 'Fetching...' : 'Fetch Models'}
                </Button>
            </Stack>
            <Form.Text className="text-muted">
                Enter Key and Base URL to fetch available models.
            </Form.Text>
          </Form.Group>

           <Form.Group className="mb-3">
            <Form.Label>Model ID</Form.Label>
            {availableModels.length > 0 ? (
                <div className="mb-2 p-2 border rounded bg-light">
                    <Form.Control 
                        size="sm" 
                        type="text" 
                        placeholder="Filter models (e.g. 'free')" 
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        className="mb-2"
                    />
                    <Form.Select 
                        value={modelId} 
                        onChange={(e) => setModelId(e.target.value)}
                    >
                        <option value="">-- Select a Model --</option>
                        {filteredModels.map(m => (
                            <option key={m.id} value={m.id}>{m.id}</option>
                        ))}
                    </Form.Select>
                    <div className="small text-muted mt-1">
                        Found {availableModels.length} models. Showing {filteredModels.length}.
                    </div>
                </div>
            ) : (
                <Form.Control
                type="text"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="e.g. llama3-8b-8192"
                />
            )}
          </Form.Group>

          <Button variant="primary" onClick={handleAddProvider} disabled={!name || !apiKey || !baseUrl || !modelId}>
            Add Provider
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
