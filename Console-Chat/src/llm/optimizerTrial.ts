import { PromptOptimizer } from './PromptOptimizer';
import { OptimizationConfig } from './types';

async function runOptimizerTrial() {
  const optimizer = new PromptOptimizer();

  const config: OptimizationConfig = {
    method: 'grid_search',
    metric: 'f1_score',
    templateType: 'few-shot',
    parameterRanges: {
      learningRate: [0.0001, 0.1],
      batchSize: [16, 128],
      epochs: [10, 100],
      regularization: [0.0, 0.01]
    }
  };

  console.log("=== Starting Prompt/Model Optimization (Grid Search) ===\n");
  console.log(`Config: ${JSON.stringify(config, null, 2)}
`);

  const result = await optimizer.optimize(config);

  console.log("\n=== Optimization Complete ===");
  console.log(`Best Score (${config.metric}): ${result.bestMetricScore.toFixed(4)}`);
  console.log("Best Hyperparameters:");
  console.log(JSON.stringify(result.bestParameters, null, 2));
  
  console.log(`\nTotal Trials: ${result.history.length}`);
}

runOptimizerTrial().catch(console.error);
