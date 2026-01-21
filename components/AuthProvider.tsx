'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import UserMenu from './UserMenu';

interface AuthProviderProps {
    children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    // Public routes that don't require auth
    const publicRoutes = ['/auth', '/auth/callback'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            setLoading(false);
        };

        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);

            // Redirect to auth if not logged in and trying to access protected route
            if (!session?.user && !isPublicRoute) {
                router.push('/auth');
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase.auth, isPublicRoute, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    // Allow public routes without auth
    if (isPublicRoute) {
        return <>{children}</>;
    }

    // Redirect to auth if not logged in
    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header with UserMenu */}
            <header className="fixed top-0 right-0 p-4 z-50">
                <UserMenu onSignOut={() => router.push('/auth')} />
            </header>
            {children}
        </div>
    );
}
