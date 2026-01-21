'use client';

import { usePredictionStore } from '@/lib/store';
import ImageUpload from './ImageUpload';

export default function InputForm() {
  const { question, bankroll, setQuestion, setBankroll, imageFile, isLoading } = usePredictionStore();

  return (
    <div className="space-y-6">
      {/* Question Input */}
      <div>
        <label htmlFor="question" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Your Question
        </label>
        <input
          type="text"
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g., Who will win this matchup?"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          disabled={isLoading}
        />
      </div>

      {/* Bankroll Input */}
      <div>
        <label htmlFor="bankroll" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Total Bankroll ($)
        </label>
        <input
          type="number"
          id="bankroll"
          value={bankroll}
          onChange={(e) => setBankroll(Number(e.target.value))}
          placeholder="100"
          min="1"
          step="1"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          disabled={isLoading}
        />
      </div>

      {/* Image Upload */}
      <ImageUpload />
    </div>
  );
}
