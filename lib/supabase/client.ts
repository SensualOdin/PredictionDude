import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // During build or if env vars missing, return a dummy client
    if (!url || !key) {
        // This shouldn't be called during build, but just in case
        console.warn('Supabase credentials not found, creating dummy client');
        return createBrowserClient(
            'https://placeholder.supabase.co',
            'placeholder-key'
        );
    }

    return createBrowserClient(url, key);
}
