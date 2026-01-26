import React, { useState } from 'react';
import { Modal, Button, Form, Row, Col, ProgressBar, Alert } from 'react-bootstrap';
import { PromptOptimizer } from '../llm/PromptOptimizer';
import { OptimizationConfig, OptimizationResult } from '../llm/types';

interface OptimizationModalProps {
  show: boolean;
  onHide: () => void;
}

export function OptimizationModal({ show, onHide }: OptimizationModalProps) {
  const [method, setMethod] = useState<'grid_search' | 'bayesian_optimization'>('grid_search');
  const [metric, setMetric] = useState<'accuracy' | 'f1_score'>('f1_score');
  const [templateType, setTemplateType] = useState<'prompt' | 'few-shot'>('few-shot');
  
  const [lrRange, setLrRange] = useState<[number, number]>([0.0001, 0.1]);
  const [batchRange, setBatchRange] = useState<[number, number]>([16, 128]);
  const [epochRange, setEpochRange] = useState<[number, number]>([10, 100]);
  
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    
    const config: OptimizationConfig = {
      method,
      metric,
      templateType,
      parameterRanges: {
        learningRate: lrRange,
        batchSize: batchRange,
        epochs: epochRange,
        regularization: [0.0, 0.01] // Default for now
      }
    };

    const optimizer = new PromptOptimizer();
    try {
      const res = await optimizer.optimize(config);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Prompt Model Optimization</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row className="mb-3">
            <Col>
              <Form.Group>
                <Form.Label>Optimization Method</Form.Label>
                <Form.Select value={method} onChange={(e) => setMethod(e.target.value as any)}>
                  <option value="grid_search">Grid Search</option>
                  <option value="bayesian_optimization">Bayesian Optimization (Mock)</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col>
              <Form.Group>
                <Form.Label>Metric</Form.Label>
                <Form.Select value={metric} onChange={(e) => setMetric(e.target.value as any)}>
                  <option value="f1_score">F1-Score</option>
                  <option value="accuracy">Accuracy</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3">
             <Col>
              <Form.Label>Learning Rate Range: {lrRange[0]} - {lrRange[1]}</Form.Label>
               {/* Simplified inputs for demo */}
             </Col>
             <Col>
                <Form.Label>Epochs: {epochRange[0]} - {epochRange[1]}</Form.Label>
             </Col>
          </Row>

          {running && <ProgressBar animated now={100} label="Optimizing..." className="mb-3" />}

          {result && (
            <Alert variant="success">
              <Alert.Heading>Optimization Complete</Alert.Heading>
              <p><strong>Best Score ({metric}):</strong> {result.bestMetricScore.toFixed(4)}</p>
              <hr />
              <h6>Best Hyperparameters:</h6>
              <ul>
                <li>Learning Rate: {result.bestParameters.learningRate}</li>
                <li>Batch Size: {result.bestParameters.batchSize}</li>
                <li>Epochs: {result.bestParameters.epochs}</li>
                <li>Regularization: {result.bestParameters.regularization}</li>
              </ul>
            </Alert>
          )}

        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={running}>
          Close
        </Button>
        <Button variant="primary" onClick={handleRun} disabled={running}>
          {running ? 'Running...' : 'Start Optimization'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
