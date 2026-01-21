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
  // Parlay-specific fields (optional, only present when isParlay = true)
  parlay?: {
    combinedOdds: number;
    combinedProbability: number;
    potentialPayout: number;
    recommendedStake: number;
  };
}

export interface PredictionRequest {
  question: string;
  bankroll: number;
  isParlay: boolean;
  inputMode: 'images' | 'manual';
  images?: string[];  // Array of base64 strings
  manualInput?: string;  // Text-based prediction input
}

// Legacy support
export interface LegacyPredictionRequest {
  question: string;
  imageBase64: string;
  bankroll: number;
}
