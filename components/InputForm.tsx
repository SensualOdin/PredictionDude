'use client';

import { usePredictionStore } from '@/lib/store';
import ImageUpload from './ImageUpload';

export default function InputForm() {
  const {
    question,
    bankroll,
    inputMode,
    isParlay,
    manualInput,
    setQuestion,
    setBankroll,
    setInputMode,
    setIsParlay,
    setManualInput,
    isLoading
  } = usePredictionStore();

  return (
    <div className="space-y-6">
      {/* Input Mode Toggle */}
      <div className="flex items-center justify-center gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <button
          type="button"
          onClick={() => setInputMode('images')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${inputMode === 'images'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          disabled={isLoading}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload Images
          </span>
        </button>
        <button
          type="button"
          onClick={() => setInputMode('manual')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${inputMode === 'manual'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          disabled={isLoading}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Manual Input
          </span>
        </button>
      </div>

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

      {/* Bankroll & Parlay Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Parlay Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Bet Type
          </label>
          <div className="flex items-center gap-4 h-[46px]">
            <button
              type="button"
              onClick={() => setIsParlay(false)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all border ${!isParlay
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                }`}
              disabled={isLoading}
            >
              Individual Bets
            </button>
            <button
              type="button"
              onClick={() => setIsParlay(true)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all border ${isParlay
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400'
                }`}
              disabled={isLoading}
            >
              🎯 Parlay
            </button>
          </div>
        </div>
      </div>

      {/* Conditional Input: Images or Manual */}
      {inputMode === 'images' ? (
        <ImageUpload />
      ) : (
        <div>
          <label htmlFor="manualInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Enter Betting Options
          </label>
          <textarea
            id="manualInput"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={`Enter your betting options, one per line. Include the odds.\n\nExample:\nLakers -5.5 at +110\nCeltics ML at -150\nOver 215.5 at -110`}
            rows={6}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            disabled={isLoading}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Tip: Include team names, spreads/totals, and odds (American or decimal format)
          </p>
        </div>
      )}
    </div>
  );
}
