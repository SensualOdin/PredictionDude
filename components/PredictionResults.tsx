'use client';

import { usePredictionStore } from '@/lib/store';
import MoneySlider from './MoneySlider';

export default function PredictionResults() {
  const { prediction, bankroll, isParlay } = usePredictionStore();

  if (!prediction) return null;

  const { prediction: pred, options, analysis, marketAnalysis, parlay } = prediction;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Parlay Badge */}
      {isParlay && (
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-semibold rounded-full">
            🎯 Parlay Bet
          </span>
        </div>
      )}

      {/* Main Prediction */}
      <div className={`rounded-xl p-6 text-white shadow-xl ${isParlay
          ? 'bg-gradient-to-r from-purple-500 to-pink-600'
          : 'bg-gradient-to-r from-blue-500 to-purple-600'
        }`}>
        <div className="space-y-2">
          <p className="text-sm font-medium opacity-90">
            {isParlay ? 'Parlay Prediction' : 'Predicted Winner'}
          </p>
          <h2 className="text-3xl font-bold">{pred.winner}</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="text-lg font-semibold">{pred.confidence.toFixed(1)}% Confidence</span>
            </div>
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
              {analysis.confidence} Certainty
            </span>
          </div>
        </div>
      </div>

      {/* Parlay Details */}
      {isParlay && parlay && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-5">
          <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-4 flex items-center gap-2">
            <span className="text-xl">🎰</span>
            Parlay Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-purple-600 dark:text-purple-400">Combined Odds</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {parlay.combinedOdds.toFixed(2)}x
              </p>
            </div>
            <div>
              <p className="text-sm text-purple-600 dark:text-purple-400">Win Probability</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {parlay.combinedProbability.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-purple-600 dark:text-purple-400">Potential Payout</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${(parlay.potentialPayout * (parlay.recommendedStake / 100) * bankroll).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-purple-600 dark:text-purple-400">Recommended Stake</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                ${((parlay.recommendedStake / 100) * bankroll).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reasoning */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Analysis</h3>
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{pred.reasoning}</p>
      </div>

      {/* Market Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Edge</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            +{marketAnalysis.totalEdge.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Best Value</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {marketAnalysis.bestValue}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Market Efficiency</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {marketAnalysis.marketEfficiency}
          </p>
        </div>
      </div>

      {/* Key Factors */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Key Factors</h3>
        <ul className="space-y-2">
          {analysis.keyFactors.map((factor, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">•</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{factor}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Risk Assessment */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-5">
        <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Risk Considerations
        </h3>
        <p className="text-sm text-amber-800 dark:text-amber-300">{analysis.risks}</p>
      </div>

      {/* Money Distribution */}
      {!isParlay && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Smart Distribution - ${bankroll} Bankroll
          </h3>
          <div className="space-y-3">
            {options.map((option) => (
              <MoneySlider
                key={option.name}
                optionName={option.name}
                stake={option.recommendedStake}
                amount={(option.recommendedStake / 100) * bankroll}
                edge={option.edge}
              />
            ))}
          </div>
        </div>
      )}

      {/* Parlay Legs */}
      {isParlay && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Parlay Legs ({options.length} selections)
          </h3>
          <div className="space-y-3">
            {options.map((option, idx) => (
              <div
                key={option.name}
                className="p-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">{option.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Implied: {option.impliedProbability.toFixed(1)}% • AI: {option.aiProbability.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${option.edge > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    Edge: {option.edge > 0 ? '+' : ''}{option.edge.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Options Table (Individual bets only) */}
      {!isParlay && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Option
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Implied %
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    AI %
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Edge
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stake
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {options.map((option) => (
                  <tr key={option.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {option.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {option.impliedProbability.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {option.aiProbability.toFixed(1)}%
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold ${option.edge > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {option.edge > 0 ? '+' : ''}{option.edge.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {option.recommendedStake.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Base Rate Reference */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Base Rate Analysis</h3>
        <p className="text-sm text-blue-800 dark:text-blue-300">{analysis.baseRate}</p>
      </div>
    </div>
  );
}
