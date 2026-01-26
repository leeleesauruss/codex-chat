// src/components/ChatInput.tsx
import React, { useState } from 'react';
import { Form, Button, InputGroup, Row, Col } from 'react-bootstrap';
import { useAppStore } from '../store';
import { PromptEngineer } from '../llm/PromptEngineer';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [taskType, setTaskType] = useState('summarization');
  const [constraints, setConstraints] = useState<string[]>([]);
  const [currentConstraint, setCurrentConstraint] = useState('');
  
  const addMessage = useAppStore((state) => state.addMessage);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const streaming = useAppStore((state) => state.streaming);
  const promptEngineer = new PromptEngineer();

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
    if (input.trim() && !streaming) {
      sendMessage(input, 'user');
      setInput('');
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
        <Button variant="outline-success" onClick={handleDirectChat} disabled={streaming}>
          Send
        </Button>
        <Button variant="primary" onClick={handleEngineer} disabled={streaming}>
          {streaming ? 'Processing...' : 'Engineer Prompt'}
        </Button>
      </InputGroup>
    </div>
  );
}
