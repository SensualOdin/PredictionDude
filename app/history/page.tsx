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
    screenshots?: string[] | null;
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
    const [isParlay, setIsParlay] = useState(false);

    // Custom bet form state
    const [customBet, setCustomBet] = useState({
        betName: '',
        odds: '',
        stake: '',
        notes: '',
    });

    // Parlay legs state
    const [parlayLegs, setParlayLegs] = useState<{ name: string; odds: string }[]>([
        { name: '', odds: '' },
        { name: '', odds: '' }
    ]);

    // Screenshot upload state
    const [screenshots, setScreenshots] = useState<string[]>([]);
    const [extracting, setExtracting] = useState(false);

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

    const addParlayLeg = () => {
        setParlayLegs([...parlayLegs, { name: '', odds: '' }]);
    };

    const removeParlayLeg = (index: number) => {
        if (parlayLegs.length > 2) {
            setParlayLegs(parlayLegs.filter((_, i) => i !== index));
        }
    };

    const updateParlayLeg = (index: number, field: 'name' | 'odds', value: string) => {
        const updated = [...parlayLegs];
        updated[index][field] = value;
        setParlayLegs(updated);
    };

    const getCombinedOdds = () => {
        return parlayLegs.reduce((acc, leg) => {
            const odds = parseFloat(leg.odds) || 1;
            return acc * odds;
        }, 1);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newImages: string[] = [];
        let filesProcessed = 0;

        // Read all files first
        Array.from(files).forEach(file => {
            if (file.size > 10 * 1024 * 1024) {
                setAddError('Each image must be under 10MB');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                newImages.push(reader.result as string);
                filesProcessed++;

                if (filesProcessed === files.length) {
                    setScreenshots(prev => [...prev, ...newImages]);
                    // Auto-extract bet info after images are loaded
                    extractBetInfo([...screenshots, ...newImages]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const extractBetInfo = async (images: string[]) => {
        if (images.length === 0) return;

        setExtracting(true);
        setAddError(null);

        try {
            const response = await fetch('/api/bets/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to extract bet info');
            }

            // Auto-fill the form based on extracted data
            if (data.isParlay && data.options.length >= 2) {
                setIsParlay(true);
                setParlayLegs(data.options.map((opt: any) => ({
                    name: opt.name,
                    odds: opt.odds.toString()
                })));
            } else if (data.options.length === 1) {
                setIsParlay(false);
                setCustomBet(prev => ({
                    ...prev,
                    betName: data.options[0].name,
                    odds: data.options[0].odds.toString()
                }));
            }

            // Fill stake if extracted
            if (data.stake) {
                setCustomBet(prev => ({
                    ...prev,
                    stake: data.stake.toString()
                }));
            }

            // Fill notes if provided
            if (data.notes) {
                setCustomBet(prev => ({
                    ...prev,
                    notes: data.notes
                }));
            }

        } catch (error) {
            console.error('Extraction error:', error);
            setAddError(error instanceof Error ? error.message : 'Failed to extract bet info. You can still fill in manually.');
        } finally {
            setExtracting(false);
        }
    };

    const removeScreenshot = (index: number) => {
        setScreenshots(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddCustomBet = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingBet(true);
        setAddError(null);

        try {
            const payload = isParlay
                ? {
                    betName: `Parlay: ${parlayLegs.map(l => l.name).join(' + ')}`,
                    odds: getCombinedOdds(),
                    stake: parseFloat(customBet.stake),
                    notes: customBet.notes,
                    isParlay: true,
                    legs: parlayLegs.map(l => ({
                        name: l.name,
                        odds: parseFloat(l.odds)
                    })),
                    screenshots: screenshots
                }
                : {
                    betName: customBet.betName,
                    odds: parseFloat(customBet.odds),
                    stake: parseFloat(customBet.stake),
                    notes: customBet.notes,
                    isParlay: false,
                    screenshots: screenshots
                };

            const response = await fetch('/api/bets/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to add bet');
            }

            // Reset form and refresh
            setCustomBet({ betName: '', odds: '', stake: '', notes: '' });
            setParlayLegs([{ name: '', odds: '' }, { name: '', odds: '' }]);
            setScreenshots([]);
            setIsParlay(false);
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
                            {/* Parlay Toggle */}
                            <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Bet Type:</span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsParlay(false)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isParlay
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-500'
                                            }`}
                                    >
                                        Single Bet
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsParlay(true)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isParlay
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-500'
                                            }`}
                                    >
                                        🎯 Parlay
                                    </button>
                                </div>
                            </div>

                            {/* Single Bet Fields */}
                            {!isParlay && (
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Bet Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={customBet.betName}
                                            onChange={(e) => setCustomBet({ ...customBet, betName: e.target.value })}
                                            placeholder="e.g., Cade Cunningham +20 points"
                                            required={!isParlay}
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
                                            required={!isParlay}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Parlay Legs */}
                            {isParlay && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Parlay Legs ({parlayLegs.length})
                                        </label>
                                        <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                                            Combined Odds: {getCombinedOdds().toFixed(2)}x
                                        </div>
                                    </div>
                                    {parlayLegs.map((leg, index) => (
                                        <div key={index} className="flex gap-3 items-center">
                                            <span className="w-6 h-6 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-bold">
                                                {index + 1}
                                            </span>
                                            <input
                                                type="text"
                                                value={leg.name}
                                                onChange={(e) => updateParlayLeg(index, 'name', e.target.value)}
                                                placeholder="Leg name (e.g., Lakers ML)"
                                                required
                                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                            />
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="1"
                                                value={leg.odds}
                                                onChange={(e) => updateParlayLeg(index, 'odds', e.target.value)}
                                                placeholder="Odds"
                                                required
                                                className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                            />
                                            {parlayLegs.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeParlayLeg(index)}
                                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={addParlayLeg}
                                        className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-all"
                                    >
                                        + Add Leg
                                    </button>
                                </div>
                            )}

                            {/* Stake & Notes (shared) */}
                            <div className="grid md:grid-cols-2 gap-4">
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
                                    {isParlay && customBet.stake && (
                                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                            Potential payout: ${(parseFloat(customBet.stake) * getCombinedOdds()).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Notes (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={customBet.notes}
                                        onChange={(e) => setCustomBet({ ...customBet, notes: e.target.value })}
                                        placeholder="e.g., DraftKings promo"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Screenshot Upload */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        📸 Screenshots {extracting && '(Extracting bet info...)'}
                                    </label>
                                    {screenshots.length > 0 && !extracting && (
                                        <button
                                            type="button"
                                            onClick={() => extractBetInfo(screenshots)}
                                            className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all"
                                        >
                                            🔄 Re-extract Info
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {/* Upload Button */}
                                    <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                                        extracting
                                            ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-700/30'
                                    }`}>
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            {extracting ? (
                                                <>
                                                    <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                                        Extracting bet information...
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        AI is reading your screenshots
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        <span className="font-semibold">Click to upload</span> or drag and drop
                                                    </p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">PNG, JPG, WEBP (max 10MB each)</p>
                                                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 font-medium">
                                                        ✨ Auto-fills bet info from screenshots
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageUpload}
                                            disabled={extracting}
                                        />
                                    </label>

                                    {/* Preview Uploaded Screenshots */}
                                    {screenshots.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {screenshots.map((img, idx) => (
                                                <div key={idx} className="relative group">
                                                    <img
                                                        src={img}
                                                        alt={`Screenshot ${idx + 1}`}
                                                        className="w-full h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeScreenshot(idx)}
                                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                                                        {idx + 1}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
                                    className={`flex-1 font-medium py-2 px-4 rounded-lg transition-all text-white ${isParlay
                                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                                            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                                        } disabled:from-gray-400 disabled:to-gray-500`}
                                >
                                    {addingBet ? 'Adding...' : isParlay ? 'Add Parlay' : 'Add Bet'}
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
                                        {/* Screenshots */}
                                        {pred.screenshots && pred.screenshots.length > 0 && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    📸 Bet Screenshots ({pred.screenshots.length})
                                                </p>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {pred.screenshots.map((img, idx) => (
                                                        <div key={idx} className="relative group cursor-pointer">
                                                            <img
                                                                src={img}
                                                                alt={`Bet screenshot ${idx + 1}`}
                                                                className="w-full h-40 object-cover rounded-lg border border-gray-300 dark:border-gray-600 hover:ring-2 hover:ring-blue-500 transition-all"
                                                                onClick={() => window.open(img, '_blank')}
                                                            />
                                                            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded font-medium">
                                                                {idx + 1}
                                                            </div>
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-all flex items-center justify-center">
                                                                <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

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
