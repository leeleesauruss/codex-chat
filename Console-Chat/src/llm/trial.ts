import { PromptEngineer } from './PromptEngineer';

async function runTrial() {
  const engineer = new PromptEngineer();
  
  const scenarios = [
    {
      name: "Scenario 1: Summarization with Constraints",
      input: {
        user_query: "The history of the Roman Empire is long and complex, spanning over a millennium from its humble beginnings as a city-state to its eventual fall in 476 AD. It was characterized by periods of expansion, internal strife, and cultural achievement.",
        task_type: "summarization",
        constraints: ["Max 3 bullet points", "Tone: academic"]
      }
    },
    {
      name: "Scenario 2: Classification of Support Ticket",
      input: {
        user_query: "My laptop screen is flickering and I've already tried restarting it twice. It's getting really hot too.",
        task_type: "classification",
        constraints: ["Output JSON only", "Include urgency level"]
      }
    },
    {
      name: "Scenario 3: Extraction from Meeting Notes",
      input: {
        user_query: "Team sync today at 10 AM. Sarah will handle the design phase, and Mark is responsible for the API implementation. Deadline is next Friday.",
        task_type: "extraction",
        constraints: ["Extract people and their roles", "Extract deadlines"]
      }
    }
  ];

  console.log("=== Prompt Engineering Trial Run ===\n");

  for (const scenario of scenarios) {
    console.log(`--- ${scenario.name} ---`);
    const result = await engineer.generatePrompt(scenario.input);
    console.log("GENERATED PROMPT:");
    console.log(result.generated_prompt);
    console.log("\nMETRICS:");
    console.log(`Confidence: ${result.confidence_score}`);
    console.log(`Rationale: ${result.explanation}`);
    console.log("\n" + "=".repeat(40) + "\n");
  }
}

runTrial().catch(console.error);
