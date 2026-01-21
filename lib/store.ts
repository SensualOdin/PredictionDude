import { create } from 'zustand';
import { PredictionResponse, PredictionOption } from './types';

interface PredictionState {
  question: string;
  bankroll: number;
  imageFile: File | null;
  imagePreview: string | null;
  isLoading: boolean;
  prediction: PredictionResponse | null;
  error: string | null;

  // Actions
  setQuestion: (question: string) => void;
  setBankroll: (bankroll: number) => void;
  setImageFile: (file: File | null) => void;
  setImagePreview: (preview: string | null) => void;
  setLoading: (loading: boolean) => void;
  setPrediction: (prediction: PredictionResponse | null) => void;
  setError: (error: string | null) => void;
  updateStake: (optionName: string, newStake: number) => void;
  reset: () => void;
}

const initialState = {
  question: 'Analyze these odds and predict the winner.',
  bankroll: 100,
  imageFile: null,
  imagePreview: null,
  isLoading: false,
  prediction: null,
  error: null,
};

export const usePredictionStore = create<PredictionState>((set) => ({
  ...initialState,

  setQuestion: (question) => set({ question }),

  setBankroll: (bankroll) => set({ bankroll }),

  setImageFile: (file) => set({ imageFile: file }),

  setImagePreview: (preview) => set({ imagePreview: preview }),

  setLoading: (loading) => set({ isLoading: loading }),

  setPrediction: (prediction) => set({ prediction }),

  setError: (error) => set({ error }),

  // Update a single option's stake and rebalance others
  updateStake: (optionName, newStake) => set((state) => {
    if (!state.prediction) return state;

    const options = [...state.prediction.options];
    const targetIndex = options.findIndex(opt => opt.name === optionName);

    if (targetIndex === -1) return state;

    // Update the target option
    options[targetIndex] = {
      ...options[targetIndex],
      recommendedStake: newStake,
    };

    // Calculate remaining stake to distribute
    const totalStake = options.reduce((sum, opt) => sum + opt.recommendedStake, 0);

    if (totalStake > 100) {
      // If total exceeds 100%, proportionally reduce others
      const excess = totalStake - 100;
      const otherOptions = options.filter((_, i) => i !== targetIndex);
      const otherTotal = otherOptions.reduce((sum, opt) => sum + opt.recommendedStake, 0);

      if (otherTotal > 0) {
        options.forEach((opt, i) => {
          if (i !== targetIndex && opt.recommendedStake > 0) {
            const reduction = (opt.recommendedStake / otherTotal) * excess;
            options[i] = {
              ...opt,
              recommendedStake: Math.max(0, opt.recommendedStake - reduction),
            };
          }
        });
      }
    }

    return {
      prediction: {
        ...state.prediction,
        options,
      },
    };
  }),

  reset: () => set(initialState),
}));
