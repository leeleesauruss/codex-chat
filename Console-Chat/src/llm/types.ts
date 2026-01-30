export interface PromptEngineeringInput {
  /**
   * User's natural language request
   */
  user_query: string;

  /**
   * Type of task (e.g., "summarization", "classification", "generation")
   */
  task_type: string;

  /**
   * List of constraints (e.g., "max_tokens: 100", "tone: formal")
   */
  constraints: string[];
}

export interface PromptEngineeringOutput {
  /**
   * The engineered prompt for the LLM
   */
  generated_prompt: string;

  /**
   * 0.0-1.0, indicating prompt quality
   */
  confidence_score: number;

  /**
   * Brief rationale for prompt construction
   */
  explanation: string;
}

export interface Hyperparameters {
  /** Range: [0.0001, 0.1] */
  learningRate: number;
  /** Range: [16, 128] */
  batchSize: number;
  /** Range: [10, 100] */
  epochs: number;
  /** Range: [0.0, 0.01] */
  regularization: number;
}

export type TemplateType = 'prompt' | 'few-shot';

export interface OptimizationConfig {
  method: 'grid_search' | 'bayesian_optimization';
  metric: 'accuracy' | 'f1_score';
  templateType: TemplateType;
  parameterRanges: {
    learningRate: [number, number];
    batchSize: [number, number];
    epochs: [number, number];
    regularization: [number, number];
  };
}

export interface OptimizationResult {
  bestParameters: Hyperparameters;
  bestMetricScore: number;
  history: Array<{ params: Hyperparameters; score: number }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: RagResult[];
  images?: ImageAttachment[];
}

export interface RagResult {
  sourcePath: string;
  content: string;
  score: number;
}

export interface ImageAttachment {
  name: string;
  mimeType: string;
  data: string; // base64 without data url prefix
  dataUrl?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  folderId: string | null; // null means root
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  modelUsed?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // For nested folders (future proofing)
  createdAt: number;
}
