import { PromptEngineeringInput, PromptEngineeringOutput } from './types';

/**
 * Service responsible for the core LLM task: generating structured, 
 * contextually relevant prompts for downstream NLP applications.
 */
export class PromptEngineer {
  
  private getTaskConfig(taskType: string) {
    const configs: Record<string, { role: string; objective: string; outputSchema: string; examples: string[] }> = {
      summarization: {
        role: "Expert Summarizer",
        objective: "Distill the provided text into a concise summary that captures all key points objectively.",
        outputSchema: "Markdown string with a title and bullet points.",
        examples: [
          "Input: [Long article about AI] -> Output: # AI Overview\n* AI is evolving rapidly.\n* Key challenges include ethics and compute."
        ]
      },
      classification: {
        role: "Data Classifier",
        objective: "Categorize the input text into the most appropriate class based on its content and tone.",
        outputSchema: "JSON object: { \"category\": \"string\", \"confidence\": number, \"reasoning\": \"string\" }",
        examples: [
          "Input: 'My order never arrived!' -> Output: { \"category\": \"Shipping Issue\", \"confidence\": 0.98, \"reasoning\": \"User explicitly mentions non-arrival of order.\" }"
        ]
      },
      generation: {
        role: "Creative Writer",
        objective: "Generate creative and engaging content based on the user's prompt, adhering to the specified tone.",
        outputSchema: "Plain text with creative formatting.",
        examples: []
      },
      translation: {
        role: "Professional Translator",
        objective: "Translate the text accurately, preserving nuance, cultural context, and tone.",
        outputSchema: "Translated text only.",
        examples: []
      },
      extraction: {
        role: "Information Architect",
        objective: "Extract specific entities and data points from the text.",
        outputSchema: "JSON object mapping entity types to values.",
        examples: [
          "Input: 'Meeting at 2PM with Bob.' -> Output: { \"time\": \"2PM\", \"attendees\": [\"Bob\"] }"
        ]
      },
      brainstorming: {
        role: "Ideation Partner",
        objective: "Generate a diverse and novel list of ideas related to the topic.",
        outputSchema: "Numbered list of ideas.",
        examples: []
      },
      default: {
        role: "Helpful Assistant",
        objective: "Respond to the user's request accurately and professionally.",
        outputSchema: "Natural language response.",
        examples: []
      }
    };
    return configs[taskType.toLowerCase()] || configs.default;
  }

  /**
   * Generates an engineered prompt based on user input and constraints.
   */
  async generatePrompt(input: PromptEngineeringInput): Promise<PromptEngineeringOutput> {
    const config = this.getTaskConfig(input.task_type);
    
    // 1. Define Scope & Role
    const systemSection = `[Role]: ${config.role}\n[Objective]: ${config.objective}`;

    // 2. Specify Constraints
    const constraintsSection = input.constraints.length > 0 
      ? `\n[Constraints]:\n- ${input.constraints.join('\n- ')}`
      : '';

    // 3. Define Input/Output Schemas
    const schemaSection = `\n[Output Schema]: ${config.outputSchema}`;

    // 4. Few-Shot Examples (Iterate on Solutions)
    const examplesSection = config.examples.length > 0
      ? `\n[Examples]:\n${config.examples.join('\n')}`
      : '';

    // 5. Construct Final Prompt
    const engineeredPrompt = `${systemSection}${constraintsSection}${schemaSection}${examplesSection}\n\n[Input]:\n${input.user_query}\n\n[Response]:`;

    // 6. Quantify Metrics (Confidence Score Calculation)
    const hasConstraints = input.constraints.length > 0;
    const hasExamples = config.examples.length > 0;
    const isSpecificTask = input.task_type !== 'default';
    
    let confidenceScore = 0.5; // Base score
    if (isSpecificTask) confidenceScore += 0.2;
    if (hasConstraints) confidenceScore += 0.2;
    if (hasExamples) confidenceScore += 0.05;
    
    return {
      generated_prompt: engineeredPrompt,
      confidence_score: Math.min(confidenceScore, 1.0),
      explanation: `Engineered a ${input.task_type} prompt with defined Role (${config.role}) and Output Schema. Integrated ${input.constraints.length} constraints and ${config.examples.length} few-shot examples.`
    };
  }
}
