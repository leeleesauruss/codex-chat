import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, ListGroup, Stack, Badge } from 'react-bootstrap';
import { useAppStore } from '../store';
import { v4 as uuidv4 } from 'uuid';

interface RagModalProps {
  show: boolean;
  onHide: () => void;
}

export function RagModal({ show, onHide }: RagModalProps) {
  const rag = useAppStore((state) => state.rag);
  const setRagEnabled = useAppStore((state) => state.setRagEnabled);
  const setRagEmbeddingModel = useAppStore((state) => state.setRagEmbeddingModel);
  const setRagTopK = useAppStore((state) => state.setRagTopK);
  const addRagSources = useAppStore((state) => state.addRagSources);
  const removeRagSource = useAppStore((state) => state.removeRagSource);
  const clearRagSources = useAppStore((state) => state.clearRagSources);
  const indexRagSources = useAppStore((state) => state.indexRagSources);
  const refreshRagIndexInfo = useAppStore((state) => state.refreshRagIndexInfo);

  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      refreshRagIndexInfo();
    }
  }, [show, refreshRagIndexInfo]);

  const handleAddFiles = async () => {
    const files = await window.electronAPI.selectRagFiles();
    if (!files.length) return;
    addRagSources(
      files.map((filePath) => ({
        id: uuidv4(),
        path: filePath,
        type: 'file',
        addedAt: Date.now(),
      })),
    );
  };

  const handleAddFolder = async () => {
    const folderPath = await window.electronAPI.selectRagFolder();
    if (!folderPath) return;
    addRagSources([
      {
        id: uuidv4(),
        path: folderPath,
        type: 'folder',
        addedAt: Date.now(),
      },
    ]);
  };

  const handleIndex = async () => {
    setIndexing(true);
    setError(null);
    try {
      const result = await indexRagSources();
      if ('error' in result) {
        setError(result.error);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIndexing(false);
    }
  };

  const handleClearIndex = async () => {
    await window.electronAPI.clearRagIndex();
    refreshRagIndexInfo();
  };

  const handleClearSources = () => {
    clearRagSources();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>RAG Context</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack gap={3}>
          <Form.Check
            type="switch"
            id="rag-enabled"
            label="Enable RAG (use local context)"
            checked={rag.enabled}
            onChange={(e) => setRagEnabled(e.target.checked)}
          />

          <Form.Group>
            <Form.Label>Embedding Model (Ollama)</Form.Label>
            <Form.Control
              value={rag.embeddingModel}
              onChange={(e) => setRagEmbeddingModel(e.target.value)}
              placeholder="nomic-embed-text"
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Top K Chunks</Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={20}
              value={rag.topK}
              onChange={(e) => setRagTopK(Number(e.target.value))}
            />
          </Form.Group>

          <div>
            <Stack direction="horizontal" gap={2} className="mb-2">
              <h6 className="mb-0">Sources</h6>
              <Badge bg={rag.sources.length ? 'primary' : 'secondary'}>{rag.sources.length}</Badge>
            </Stack>
            <ListGroup>
              {rag.sources.length === 0 && (
                <ListGroup.Item className="text-muted">No sources added yet.</ListGroup.Item>
              )}
              {rag.sources.map((source) => (
                <ListGroup.Item key={source.id}>
                  <Stack direction="horizontal" gap={2}>
                    <div className="small text-truncate" style={{ maxWidth: '70%' }}>
                      <strong>{source.type === 'folder' ? 'Folder' : 'File'}:</strong> {source.path}
                    </div>
                    <div className="ms-auto">
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => removeRagSource(source.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </Stack>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>

          <Stack direction="horizontal" gap={2}>
            <Button variant="outline-primary" onClick={handleAddFiles}>
              Add Files
            </Button>
            <Button variant="outline-primary" onClick={handleAddFolder}>
              Add Folder
            </Button>
            <Button variant="success" onClick={handleIndex} disabled={indexing || !rag.sources.length}>
              {indexing ? 'Indexing…' : 'Index Now'}
            </Button>
            <Button variant="outline-danger" onClick={handleClearIndex} disabled={indexing}>
              Clear Index
            </Button>
            <Button variant="outline-danger" onClick={handleClearSources} disabled={indexing}>
              Remove Sources
            </Button>
          </Stack>

          <div className="small text-muted">
            Indexed chunks: {rag.indexedCount || 0}
            {rag.lastIndexedAt ? ` • Last indexed ${new Date(rag.lastIndexedAt).toLocaleString()}` : ''}
          </div>
          {error && <div className="text-danger small">Indexing error: {error}</div>}
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
