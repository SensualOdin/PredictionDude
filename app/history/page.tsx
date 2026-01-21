'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Prediction {
    id: string;
    question: string;
    bankroll: number;
    is_parlay: boolean;
    predicted_winner: string;
    confidence: number;
    reasoning: string;
    outcome: 'pending' | 'won' | 'lost';
    created_at: string;
    settled_at: string | null;
    prediction_options: PredictionOption[];
}

interface PredictionOption {
    id: string;
    name: string;
    implied_probability: number;
    ai_probability: number;
    edge: number;
    recommended_stake: number;
    outcome: 'pending' | 'won' | 'lost';
}

export default function HistoryPage() {
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [addingBet, setAddingBet] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    // Custom bet form state
    const [customBet, setCustomBet] = useState({
        betName: '',
        odds: '',
        stake: '',
        notes: '',
    });

    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        fetchPredictions();
    }, [filter]);

    const fetchPredictions = async () => {
        setLoading(true);
        let query = supabase
            .from('predictions')
            .select(`
        *,
        prediction_options (*)
      `)
            .order('created_at', { ascending: false });

        if (filter !== 'all') {
            query = query.eq('outcome', filter);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching predictions:', error);
        } else {
            setPredictions(data || []);
        }
        setLoading(false);
    };

    const handleAddCustomBet = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingBet(true);
        setAddError(null);

        try {
            const response = await fetch('/api/bets/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    betName: customBet.betName,
                    odds: parseFloat(customBet.odds),
                    stake: parseFloat(customBet.stake),
                    notes: customBet.notes,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to add bet');
            }

            // Reset form and refresh
            setCustomBet({ betName: '', odds: '', stake: '', notes: '' });
            setShowAddForm(false);
            fetchPredictions();
        } catch (error) {
            setAddError(error instanceof Error ? error.message : 'Failed to add bet');
        } finally {
            setAddingBet(false);
        }
    };

    const updatePredictionOutcome = async (id: string, outcome: 'won' | 'lost') => {
        const { error } = await supabase
            .from('predictions')
            .update({
                outcome,
                settled_at: new Date().toISOString()
            })
            .eq('id', id);

        if (!error) {
            setPredictions(prev =>
                prev.map(p => p.id === id ? { ...p, outcome, settled_at: new Date().toISOString() } : p)
            );
        }
    };

    const updateOptionOutcome = async (predictionId: string, optionId: string, outcome: 'won' | 'lost') => {
        const { error } = await supabase
            .from('prediction_options')
            .update({ outcome })
            .eq('id', optionId);

        if (!error) {
            setPredictions(prev =>
                prev.map(p => {
                    if (p.id === predictionId) {
                        return {
                            ...p,
                            prediction_options: p.prediction_options.map(opt =>
                                opt.id === optionId ? { ...opt, outcome } : opt
                            )
                        };
                    }
                    return p;
                })
            );
        }
    };

    const getStats = () => {
        const total = predictions.length;
        const won = predictions.filter(p => p.outcome === 'won').length;
        const lost = predictions.filter(p => p.outcome === 'lost').length;
        const pending = predictions.filter(p => p.outcome === 'pending').length;
        const winRate = won + lost > 0 ? ((won / (won + lost)) * 100).toFixed(1) : '0';
        return { total, won, lost, pending, winRate };
    };

    const stats = getStats();

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-4 py-8 max-w-5xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Bet History
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Track and manage your predictions
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${showAddForm
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Add Custom Bet
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            AI Prediction
                        </button>
                    </div>
                </div>

                {/* Add Custom Bet Form */}
                {showAddForm && (
                    <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                            <span>📝</span> Add Custom Bet
                        </h2>
                        <form onSubmit={handleAddCustomBet} className="space-y-4">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Bet Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={customBet.betName}
                                        onChange={(e) => setCustomBet({ ...customBet, betName: e.target.value })}
                                        placeholder="e.g., Cade Cunningham +20 points"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Odds (decimal) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="1"
                                        value={customBet.odds}
                                        onChange={(e) => setCustomBet({ ...customBet, odds: e.target.value })}
                                        placeholder="e.g., 1.5"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        1.5x = +100 American
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Stake ($) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={customBet.stake}
                                        onChange={(e) => setCustomBet({ ...customBet, stake: e.target.value })}
                                        placeholder="e.g., 50"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Notes (optional)
                                </label>
                                <input
                                    type="text"
                                    value={customBet.notes}
                                    onChange={(e) => setCustomBet({ ...customBet, notes: e.target.value })}
                                    placeholder="e.g., DraftKings promo, player prop"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {addError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-sm text-red-800 dark:text-red-300">{addError}</p>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={addingBet}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-2 px-4 rounded-lg transition-all"
                                >
                                    {addingBet ? 'Adding...' : 'Add Bet'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Won</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.won}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Lost</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.lost}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.winRate}%</p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6">
                    {(['all', 'pending', 'won', 'lost'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Predictions List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
                    </div>
                ) : predictions.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">No bets found</p>
                        <div className="flex gap-3 justify-center mt-4">
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Add a custom bet →
                            </button>
                            <span className="text-gray-400">or</span>
                            <button
                                onClick={() => router.push('/')}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Make an AI prediction →
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {predictions.map((pred) => (
                            <div
                                key={pred.id}
                                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                                {/* Header Row */}
                                <div
                                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    onClick={() => setExpandedId(expandedId === pred.id ? null : pred.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${pred.outcome === 'won' ? 'bg-green-500' :
                                                pred.outcome === 'lost' ? 'bg-red-500' :
                                                    'bg-yellow-500'
                                                }`} />
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {pred.predicted_winner}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(pred.created_at).toLocaleDateString()}
                                                    {pred.prediction_options?.[0]?.recommended_stake && (
                                                        <> • ${pred.prediction_options[0].recommended_stake} stake</>
                                                    )}
                                                    {pred.prediction_options?.[0]?.implied_probability && (
                                                        <> • {(1 / (pred.prediction_options[0].implied_probability / 100)).toFixed(2)}x odds</>
                                                    )}
                                                    {pred.is_parlay && ' • 🎯 Parlay'}
                                                    {!pred.confidence && ' • 📝 Custom'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${pred.outcome === 'won' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                pred.outcome === 'lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                }`}>
                                                {pred.outcome.toUpperCase()}
                                            </span>
                                            <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedId === pred.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {expandedId === pred.id && (
                                    <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                                        {/* Reasoning/Notes */}
                                        {pred.reasoning && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {pred.confidence ? 'Reasoning' : 'Notes'}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{pred.reasoning}</p>
                                            </div>
                                        )}

                                        {/* Options */}
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bet Details</p>
                                            <div className="space-y-2">
                                                {pred.prediction_options.map((opt) => (
                                                    <div key={opt.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-gray-100">{opt.name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {opt.implied_probability && (
                                                                    <>Odds: {(1 / (opt.implied_probability / 100)).toFixed(2)}x ({opt.implied_probability?.toFixed(1)}% implied) • </>
                                                                )}
                                                                Stake: ${opt.recommended_stake?.toFixed(2)}
                                                                {opt.edge !== null && opt.edge !== undefined && (
                                                                    <> • Edge: {opt.edge > 0 ? '+' : ''}{opt.edge?.toFixed(1)}%</>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); updateOptionOutcome(pred.id, opt.id, 'won'); }}
                                                                className={`px-3 py-1 rounded text-sm font-medium transition-all ${opt.outcome === 'won'
                                                                    ? 'bg-green-600 text-white'
                                                                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                                                                    }`}
                                                            >
                                                                Won
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); updateOptionOutcome(pred.id, opt.id, 'lost'); }}
                                                                className={`px-3 py-1 rounded text-sm font-medium transition-all ${opt.outcome === 'lost'
                                                                    ? 'bg-red-600 text-white'
                                                                    : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'
                                                                    }`}
                                                            >
                                                                Lost
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Mark Overall Outcome */}
                                        {pred.outcome === 'pending' && (
                                            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mark Overall Result</p>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => updatePredictionOutcome(pred.id, 'won')}
                                                        className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all"
                                                    >
                                                        ✓ Won
                                                    </button>
                                                    <button
                                                        onClick={() => updatePredictionOutcome(pred.id, 'lost')}
                                                        className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all"
                                                    >
                                                        ✗ Lost
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
