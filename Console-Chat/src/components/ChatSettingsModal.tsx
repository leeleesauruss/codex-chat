import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import { ChatSettings } from '../llm/types';

interface ModelOption {
  value: string;
  label: string;
}

interface ChatSettingsModalProps {
  show: boolean;
  onHide: () => void;
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
  modelOptions: ModelOption[];
  globalModelLabel: string;
}

const toNumberOrNull = (value: string) => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStopSequences = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export function ChatSettingsModal({
  show,
  onHide,
  settings,
  onSave,
  modelOptions,
  globalModelLabel,
}: ChatSettingsModalProps) {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState('');
  const [maxTokens, setMaxTokens] = useState('');
  const [topP, setTopP] = useState('');
  const [seed, setSeed] = useState('');
  const [stopSequences, setStopSequences] = useState('');
  const [modelOverride, setModelOverride] = useState('');

  useEffect(() => {
    if (!show) return;
    const nextSystemPrompt = settings.systemPrompt || '';
    const nextTemperature =
      settings.temperature === null || settings.temperature === undefined ? '' : String(settings.temperature);
    const nextMaxTokens =
      settings.maxTokens === null || settings.maxTokens === undefined ? '' : String(settings.maxTokens);
    const nextTopP = settings.topP === null || settings.topP === undefined ? '' : String(settings.topP);
    const nextSeed = settings.seed === null || settings.seed === undefined ? '' : String(settings.seed);
    const nextStopSequences = (settings.stopSequences || []).join('\n');
    const nextModelOverride = settings.modelOverride || '';

    setSystemPrompt((prev) => (prev === nextSystemPrompt ? prev : nextSystemPrompt));
    setTemperature((prev) => (prev === nextTemperature ? prev : nextTemperature));
    setMaxTokens((prev) => (prev === nextMaxTokens ? prev : nextMaxTokens));
    setTopP((prev) => (prev === nextTopP ? prev : nextTopP));
    setSeed((prev) => (prev === nextSeed ? prev : nextSeed));
    setStopSequences((prev) => (prev === nextStopSequences ? prev : nextStopSequences));
    setModelOverride((prev) => (prev === nextModelOverride ? prev : nextModelOverride));
  }, [
    show,
    settings.systemPrompt,
    settings.temperature,
    settings.maxTokens,
    settings.topP,
    settings.seed,
    settings.modelOverride,
    settings.stopSequences,
  ]);

  const handleSave = () => {
    onSave({
      systemPrompt: systemPrompt.trim(),
      temperature: toNumberOrNull(temperature),
      maxTokens: toNumberOrNull(maxTokens),
      topP: toNumberOrNull(topP),
      seed: toNumberOrNull(seed),
      stopSequences: toStopSequences(stopSequences),
      modelOverride: modelOverride.trim() === '' ? null : modelOverride,
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Chat Settings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3" controlId="chatSettingsSystemPrompt">
            <Form.Label className="fw-bold">System Prompt</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Optional system instructions for this chat."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </Form.Group>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group controlId="chatSettingsTemperature">
                <Form.Label className="fw-bold">Temperature</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  placeholder="Default"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="chatSettingsMaxTokens">
                <Form.Label className="fw-bold">Max Tokens</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Default"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
          <Row className="g-3 mt-1">
            <Col md={6}>
              <Form.Group controlId="chatSettingsTopP">
                <Form.Label className="fw-bold">Top P</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  placeholder="Default"
                  value={topP}
                  onChange={(e) => setTopP(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="chatSettingsSeed">
                <Form.Label className="fw-bold">Seed</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Default"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mt-3" controlId="chatSettingsStopSequences">
            <Form.Label className="fw-bold">Stop Sequences</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="One per line"
              value={stopSequences}
              onChange={(e) => setStopSequences(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mt-3" controlId="chatSettingsModelOverride">
            <Form.Label className="fw-bold">Model Override</Form.Label>
            <Form.Select value={modelOverride} onChange={(e) => setModelOverride(e.target.value)}>
              <option value="">{globalModelLabel}</option>
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
