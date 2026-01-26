import { describe, it, expect } from 'vitest';
import { PromptEngineer } from './PromptEngineer';

describe('PromptEngineer', () => {
  const engineer = new PromptEngineer();

  it('should generate a basic prompt for default task', async () => {
    const result = await engineer.generatePrompt({
      user_query: 'Hello world',
      task_type: 'default',
      constraints: []
    });

    expect(result.confidence_score).toBeGreaterThan(0);
    expect(result.generated_prompt).toContain('[Role]: Helpful Assistant');
    expect(result.generated_prompt).toContain('Hello world');
  });

  it('should include constraints when provided', async () => {
    const result = await engineer.generatePrompt({
      user_query: 'Analyze this',
      task_type: 'classification',
      constraints: ['Use strict tone', 'Output JSON only']
    });

    expect(result.generated_prompt).toContain('[Constraints]:');
    expect(result.generated_prompt).toContain('- Use strict tone');
    expect(result.generated_prompt).toContain('- Output JSON only');
    expect(result.confidence_score).toBeGreaterThan(0.7); // Boosted by constraints
  });

  it('should include specialized schema for extraction task', async () => {
    const result = await engineer.generatePrompt({
      user_query: 'My name is Alice',
      task_type: 'extraction',
      constraints: []
    });

    expect(result.generated_prompt).toContain('[Output Schema]: JSON object mapping entity types to values.');
    expect(result.generated_prompt).toContain('[Examples]:');
  });
});
