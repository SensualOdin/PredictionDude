'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface LearningIteration {
    id: string;
    predictions_analyzed: number;
    win_rate: number;
    analysis: string;
    created_at: string;
}

interface LearningResult {
    stats: {
        total: number;
        won: number;
        winRate: string;
    };
    analysis: {
        calibration: string;
        strengths: string[];
        weaknesses: string[];
        patterns: string[];
    };
    recommendations: {
        section: string;
        change: string;
        rationale: string;
    }[];
    summary: string;
}

export default function LearnPage() {
    const [iterations, setIterations] = useState<LearningIteration[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<LearningResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        fetchIterations();
    }, []);

    const fetchIterations = async () => {
        const { data, error } = await supabase
            .from('learning_iterations')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (!error && data) {
            setIterations(data);
        }
        setLoading(false);
    };

    const runAnalysis = async () => {
        setAnalyzing(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/learn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed');
            }

            setResult(data);
            fetchIterations();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-4 py-8 max-w-5xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            AI Learning Center
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Improve predictions based on your results
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/history')}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Bet History
                    </button>
                </div>

                {/* Run Analysis Card */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-8 mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                            <span className="text-2xl">🧠</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Learn from Your Results</h2>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                AI will analyze your settled bets and suggest improvements to the prediction system
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={runAnalysis}
                        disabled={analyzing}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-3"
                    >
                        {analyzing ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                Analyzing your predictions...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Run Learning Analysis
                            </>
                        )}
                    </button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-red-800 dark:text-red-300">{error}</p>
                    </div>
                )}

                {/* Analysis Result */}
                {result && (
                    <div className="space-y-6 mb-8">
                        {/* Summary */}
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                            <h3 className="font-semibold text-green-900 dark:text-green-200 mb-2 flex items-center gap-2">
                                <span>✅</span> Analysis Complete
                            </h3>
                            <p className="text-green-800 dark:text-green-300">{result.summary}</p>
                            <div className="mt-3 flex gap-4 text-sm">
                                <span className="text-green-700 dark:text-green-400">
                                    {result.stats.total} predictions analyzed
                                </span>
                                <span className="text-green-700 dark:text-green-400">
                                    {result.stats.winRate}% win rate
                                </span>
                            </div>
                        </div>

                        {/* Calibration */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">📊 Calibration</h3>
                            <p className="text-gray-700 dark:text-gray-300">{result.analysis.calibration}</p>
                        </div>

                        {/* Strengths & Weaknesses */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                                <h3 className="font-semibold text-green-700 dark:text-green-400 mb-3">💪 Strengths</h3>
                                <ul className="space-y-2">
                                    {result.analysis.strengths.map((s, i) => (
                                        <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                                            <span className="text-green-500">•</span>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                                <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-3">⚠️ Areas to Improve</h3>
                                <ul className="space-y-2">
                                    {result.analysis.weaknesses.map((w, i) => (
                                        <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                                            <span className="text-amber-500">•</span>
                                            {w}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Recommendations */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">📝 Recommendations</h3>
                            <div className="space-y-4">
                                {result.recommendations.map((rec, i) => (
                                    <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-1">
                                            {rec.section}
                                        </p>
                                        <p className="text-gray-700 dark:text-gray-300 text-sm">{rec.change}</p>
                                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-2 italic">{rec.rationale}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Previous Iterations */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">📚 Learning History</h3>
                    {loading ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">Loading...</p>
                    ) : iterations.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                            No learning iterations yet. Run your first analysis above!
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {iterations.map((iter) => (
                                <div key={iter.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                            {new Date(iter.created_at).toLocaleDateString()}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {iter.predictions_analyzed} predictions • {iter.win_rate?.toFixed(1)}% win rate
                                        </p>
                                    </div>
                                    <span className="text-xs text-blue-600 dark:text-blue-400">
                                        Iteration #{iterations.length - iterations.indexOf(iter)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
