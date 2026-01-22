import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // During build or if env vars missing, return a dummy client
    if (!url || !key) {
        console.warn('Supabase credentials not found during server client creation');
        // Return a minimal dummy client for build time
        return createServerClient(
            'https://placeholder.supabase.co',
            'placeholder-key',
            {
                cookies: {
                    getAll() { return []; },
                    setAll() { },
                },
            }
        );
    }

    const cookieStore = await cookies();

    return createServerClient(url, key, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // The `setAll` method was called from a Server Component.
                    // This can be ignored if you have middleware refreshing
                    // user sessions.
                }
            },
        },
    });
}
