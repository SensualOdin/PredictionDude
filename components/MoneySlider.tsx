'use client';

import { usePredictionStore } from '@/lib/store';

interface MoneySliderProps {
  optionName: string;
  stake: number;
  amount: number;
  edge: number;
}

export default function MoneySlider({ optionName, stake, amount, edge }: MoneySliderProps) {
  const { updateStake, bankroll } = usePredictionStore();

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStake = Number(e.target.value);
    updateStake(optionName, newStake);
  };

  const edgeColor = edge > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const bgColor = edge > 0 ? 'bg-green-500' : 'bg-gray-400';

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
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

      {/* Slider */}
      <div className="space-y-2">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={stake}
          onChange={handleSliderChange}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, ${edge > 0 ? '#10b981' : '#6b7280'} 0%, ${edge > 0 ? '#10b981' : '#6b7280'} ${stake}%, #e5e7eb ${stake}%, #e5e7eb 100%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>$0</span>
          <span>${bankroll}</span>
        </div>
      </div>

      {/* Visual Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full ${bgColor} transition-all duration-300`}
          style={{ width: `${stake}%` }}
        />
      </div>
    </div>
  );
}
