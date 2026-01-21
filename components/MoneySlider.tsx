'use client';

interface MoneySliderProps {
  optionName: string;
  stake: number;
  amount: number;
  edge: number;
}

export default function MoneySlider({ optionName, stake, amount, edge }: MoneySliderProps) {
  const edgeColor = edge > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const bgColor = edge > 0 ? 'bg-green-500' : 'bg-gray-400';
  const borderColor = edge > 0 ? 'border-green-200 dark:border-green-800' : 'border-gray-200 dark:border-gray-700';

  return (
    <div className={`p-4 rounded-lg border ${borderColor} bg-white dark:bg-gray-800 space-y-3`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{optionName}</h3>
          <p className={`text-sm font-medium ${edgeColor}`}>
            Edge: {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ${amount.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{stake.toFixed(1)}% of bankroll</p>
        </div>
      </div>

      {/* AI Recommendation Badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
          </svg>
          AI Recommended
        </span>
      </div>

      {/* Visual Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full ${bgColor} transition-all duration-300`}
          style={{ width: `${Math.min(stake, 100)}%` }}
        />
      </div>
    </div>
  );
}
