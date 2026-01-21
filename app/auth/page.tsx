'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '@/components/AuthForm';

export default function AuthPage() {
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const router = useRouter();

    const handleSuccess = () => {
        router.push('/');
        router.refresh();
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Project Oracle
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        {mode === 'signin' ? 'Welcome back!' : 'Create your account'}
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
                    <AuthForm
                        mode={mode}
                        onSuccess={handleSuccess}
                        onToggleMode={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                    />
                </div>

                <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Track your bets and let AI learn from your results
                </p>
            </div>
        </main>
    );
}
