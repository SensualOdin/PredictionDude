export interface PredictionOption {
  name: string;
  impliedProbability: number;
  aiProbability: number;
  edge: number;
  recommendedStake: number;
}

export interface PredictionResponse {
  prediction: {
    winner: string;
    confidence: number;
    reasoning: string;
  };
  options: PredictionOption[];
  analysis: {
    baseRate: string;
    keyFactors: string[];
    risks: string;
    confidence: 'High' | 'Medium' | 'Low';
  };
  marketAnalysis: {
    totalEdge: number;
    bestValue: string;
    marketEfficiency: string;
  };
}

export interface PredictionRequest {
  question: string;
  imageBase64: string;
  bankroll: number;
}
