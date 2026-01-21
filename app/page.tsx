'use client';

import { useState } from 'react';
import { usePredictionStore } from '@/lib/store';
import InputForm from '@/components/InputForm';
import PredictionResults from '@/components/PredictionResults';

export default function Home() {
  const {
    question,
    bankroll,
    imageFile,
    imagePreview,
    isLoading,
    prediction,
    error,
    setLoading,
    setPrediction,
    setError,
  } = usePredictionStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile) {
      setError('Please upload an image of the odds');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert image to base64
      const base64 = imagePreview || '';

      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          imageBase64: base64,
          bankroll,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate prediction');
      }

      setPrediction(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Prediction error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Project Oracle
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            AI-Powered Prediction & Bankroll Distribution Assistant
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Powered by Gemini 2.0 Flash
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Input Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
            <form onSubmit={handleSubmit}>
              <InputForm />

              {/* Error Display */}
              {error && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !imageFile}
                className="mt-6 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-lg transition-all transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-lg disabled:shadow-none flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Prediction
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Section */}
          {prediction && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
              <PredictionResults />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Built with Next.js, React, Tailwind CSS, and Google Gemini AI
          </p>
          <p className="mt-2">
            This tool provides predictions based on AI analysis. Always gamble responsibly.
          </p>
        </div>
      </div>
    </main>
  );
}
