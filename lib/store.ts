import { create } from 'zustand';
import { PredictionResponse } from './types';

interface ImageData {
  file: File;
  preview: string;
}

interface PredictionState {
  // Input mode
  inputMode: 'images' | 'manual';
  isParlay: boolean;

  // Form fields
  question: string;
  bankroll: number;
  manualInput: string;

  // Multiple images
  images: ImageData[];

  // Loading/results
  isLoading: boolean;
  prediction: PredictionResponse | null;
  error: string | null;

  // Actions
  setInputMode: (mode: 'images' | 'manual') => void;
  setIsParlay: (isParlay: boolean) => void;
  setQuestion: (question: string) => void;
  setBankroll: (bankroll: number) => void;
  setManualInput: (input: string) => void;
  addImage: (file: File, preview: string) => void;
  removeImage: (index: number) => void;
  clearImages: () => void;
  setLoading: (loading: boolean) => void;
  setPrediction: (prediction: PredictionResponse | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  inputMode: 'images' as const,
  isParlay: false,
  question: 'Analyze these odds and predict the winner.',
  bankroll: 100,
  manualInput: '',
  images: [],
  isLoading: false,
  prediction: null,
  error: null,
};

export const usePredictionStore = create<PredictionState>((set) => ({
  ...initialState,

  setInputMode: (mode) => set({ inputMode: mode }),

  setIsParlay: (isParlay) => set({ isParlay }),

  setQuestion: (question) => set({ question }),

  setBankroll: (bankroll) => set({ bankroll }),

  setManualInput: (input) => set({ manualInput: input }),

  addImage: (file, preview) => set((state) => ({
    images: [...state.images, { file, preview }]
  })),

  removeImage: (index) => set((state) => ({
    images: state.images.filter((_, i) => i !== index)
  })),

  clearImages: () => set({ images: [] }),

  setLoading: (loading) => set({ isLoading: loading }),

  setPrediction: (prediction) => set({ prediction }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
