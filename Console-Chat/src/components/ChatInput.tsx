// src/components/ChatInput.tsx
import React, { useRef, useState } from 'react';
import { Form, Button, InputGroup, Row, Col } from 'react-bootstrap';
import { useAppStore } from '../store';
import { PromptEngineer } from '../llm/PromptEngineer';
import { ImageAttachment } from '../llm/types';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [taskType, setTaskType] = useState('summarization');
  const [constraints, setConstraints] = useState<string[]>([]);
  const [currentConstraint, setCurrentConstraint] = useState('');
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const addMessage = useAppStore((state) => state.addMessage);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const streaming = useAppStore((state) => state.streaming);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const providers = useAppStore((state) => state.settings.providers);
  const promptEngineer = new PromptEngineer();

  const resolveSelectedModelId = () => {
    if (!selectedModel) return '';
    const provider = providers.find((p) => p.name === selectedModel);
    return provider?.modelId || selectedModel;
  };

  const isLikelyVisionModel = (modelId: string) => {
    if (!modelId) return false;
    const value = modelId.toLowerCase();
    return /(vision|llava|bakllava|moondream|qwen2?-vl|qwen-vl|gemini|gpt-4o|gpt-4\.1|gpt-4-vision|claude-3|claude-3\.5|claude-4|pixtral|phi-3-vision)/.test(
      value,
    );
  };

  const selectedModelId = resolveSelectedModelId();
  const visionCapable = isLikelyVisionModel(selectedModelId);
  const showVisionWarning = attachments.length > 0 && !visionCapable;

  const handleAddConstraint = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentConstraint.trim()) {
        setConstraints([...constraints, currentConstraint.trim()]);
        setCurrentConstraint('');
      }
    }
  };

  const removeConstraint = (indexToRemove: number) => {
    setConstraints(constraints.filter((_, index) => index !== indexToRemove));
  };

  const handleEngineer = async () => {
    if (input.trim() && !streaming) {
      addMessage({ role: 'user', content: input });
      
      try {
        const result = await promptEngineer.generatePrompt({
          user_query: input,
          task_type: taskType,
          constraints: constraints
        });

        const assistantContent = `### Engineered Prompt\n\`\`\`\n${result.generated_prompt}\n\`\`\`\n\n**Confidence Score:** ${result.confidence_score.toFixed(2)}\n\n**Rationale:** ${result.explanation}`;
        
        addMessage({ role: 'assistant', content: assistantContent });
        
        setInput('');
        setConstraints([]);
      } catch (error) {
        console.error("Prompt Engineering failed:", error);
        addMessage({ role: 'assistant', content: "Error: Failed to generate engineered prompt." });
      }
    }
  };

  const handleDirectChat = () => {
    if ((!input.trim() && attachments.length === 0) || streaming) {
      return;
    }
    if (!streaming) {
      sendMessage(input, 'user', attachments);
      setInput('');
      setAttachments([]);
      // Keep constraints for now, or clear them? 
      // Direct chat usually ignores prompt engineering constraints unless we manually append them. 
      // For now, let's just clear the input to keep it simple.
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
       handleEngineer();
    }
  };

  const handlePickImages = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const base64 = dataUrl.split(',')[1] || '';
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            mimeType: file.type || 'image/png',
            data: base64,
            dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-3 chat-input-panel">
      <Row className="mb-2">
        <Col md={4}>
          <Form.Group controlId="taskType">
            <Form.Label className="small fw-bold">Task Type</Form.Label>
            <Form.Select 
              size="sm" 
              value={taskType} 
              onChange={(e) => setTaskType(e.target.value)}
            >
              <option value="summarization">Summarization</option>
              <option value="classification">Classification</option>
              <option value="generation">Generation</option>
              <option value="translation">Translation</option>
              <option value="extraction">Information Extraction</option>
              <option value="brainstorming">Brainstorming</option>
              <option value="default">General Purpose</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={8}>
          <Form.Group controlId="constraints">
            <Form.Label className="small fw-bold">Constraints</Form.Label>
            <div className="d-flex flex-wrap gap-1 mb-1">
              {constraints.map((c, idx) => (
                <span key={idx} className="badge bg-secondary d-flex align-items-center">
                  {c}
                  <button 
                    type="button" 
                    className="btn-close btn-close-white ms-2" 
                    style={{ fontSize: '0.5em' }}
                    onClick={() => removeConstraint(idx)}
                    aria-label="Remove"
                  />
                </span>
              ))}
            </div>
            <Form.Control
              size="sm"
              type="text"
              placeholder="Type constraint and press Enter..."
              value={currentConstraint}
              onChange={(e) => setCurrentConstraint(e.target.value)}
              onKeyDown={handleAddConstraint}
            />
          </Form.Group>
        </Col>
      </Row>
      <InputGroup>
        <Form.Control
          as="textarea"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter text... (Ctrl+Enter to Engineer)"
          disabled={streaming}
        />
        <Button variant="outline-secondary" onClick={handlePickImages} disabled={streaming}>
          Attach
        </Button>
        <Button variant="outline-success" onClick={handleDirectChat} disabled={streaming}>
          Send
        </Button>
        <Button variant="primary" onClick={handleEngineer} disabled={streaming}>
          {streaming ? 'Processing...' : 'Engineer Prompt'}
        </Button>
      </InputGroup>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        style={{ display: 'none' }}
        onChange={handleFilesSelected}
      />
      {showVisionWarning && (
        <div className="alert alert-warning py-1 px-2 mt-2 mb-0" role="alert">
          Images are attached, but the selected model doesn't look vision-capable. Switch to a
          vision model (e.g. LLaVA, Qwen2-VL, GPT-4o) to use images.
        </div>
      )}
      {attachments.length > 0 && (
        <div className="mt-2 d-flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <div key={`${att.name}-${idx}`} className="border rounded p-1 position-relative">
              <img
                src={att.dataUrl || `data:${att.mimeType};base64,${att.data}`}
                alt={att.name}
                style={{ width: '60px', height: '60px', objectFit: 'cover' }}
              />
              <button
                type="button"
                className="btn-close position-absolute top-0 end-0"
                aria-label="Remove"
                onClick={() => removeAttachment(idx)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
