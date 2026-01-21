'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePredictionStore } from '@/lib/store';
import PredictionResults from '@/components/PredictionResults';

export default function ResultsPage() {
    const router = useRouter();
    const { prediction, bankroll, question, isParlay, inputMode } = usePredictionStore();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (!prediction) {
            router.push('/');
        }
    }, [prediction, router]);

    const handleSaveBet = async () => {
        if (!prediction || saved) return;

        setSaving(true);
        setSaveError(null);

        try {
            const response = await fetch('/api/bets/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prediction: prediction.prediction,
                    options: prediction.options,
                    parlay: prediction.parlay,
                    isParlay,
                    question,
                    bankroll,
                    inputMode,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save bet');
            }

            setSaved(true);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to save bet');
        } finally {
            setSaving(false);
        }
    };

    if (!prediction) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-4 py-8 max-w-5xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Prediction Results
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            AI Analysis for ${bankroll} Bankroll
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Save Bet Button */}
                        <button
                            onClick={handleSaveBet}
                            disabled={saving || saved}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${saved
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white disabled:from-gray-400 disabled:to-gray-500'
                                }`}
                        >
                            {saving ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                    Saving...
                                </>
                            ) : saved ? (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                    </svg>
                                    Save Bet
                                </>
                            )}
                        </button>

                        {/* New Prediction Button */}
                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            New Prediction
                        </button>
                    </div>
                </div>

                {/* Save Error */}
                {saveError && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-300">{saveError}</p>
                    </div>
                )}

                {/* Results */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
                    <PredictionResults />
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    <p>
                        Powered by Gemini 3 Pro • Always gamble responsibly
                    </p>
                </div>
            </div>
        </main>
    );
}
