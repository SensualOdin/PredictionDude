import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
    '/auth',
    '/auth/callback',
];

// API routes that don't require authentication
const PUBLIC_API_ROUTES: string[] = [
    // Add any public API routes here if needed
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public routes
    if (PUBLIC_ROUTES.includes(pathname)) {
        return NextResponse.next();
    }

    // Allow public API routes
    if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Skip middleware during build time
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME) {
        return NextResponse.next();
    }

    // Check authentication for protected routes
    try {
        // Only check auth if we have Supabase credentials
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            // During development or build, allow requests
            if (process.env.NODE_ENV !== 'production') {
                return NextResponse.next();
            }

            // In production without credentials, redirect to auth
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Service configuration error' },
                    { status: 503 }
                );
            }

            const url = request.nextUrl.clone();
            url.pathname = '/auth';
            return NextResponse.redirect(url);
        }

        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        // If no user and trying to access protected route, redirect to auth
        if (!user || error) {
            // For API routes, return 401
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                );
            }

            // For page routes, redirect to auth
            const url = request.nextUrl.clone();
            url.pathname = '/auth';
            return NextResponse.redirect(url);
        }

        // User is authenticated, allow request
        return NextResponse.next();

    } catch (error) {
        console.error('Middleware auth error:', error);

        // On error, treat as unauthorized
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Authentication error' },
                { status: 500 }
            );
        }

        const url = request.nextUrl.clone();
        url.pathname = '/auth';
        return NextResponse.redirect(url);
    }
}

// Configure which routes this middleware runs on
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public assets
         * - _not-found (Next.js not found page)
         */
        '/((?!_next/static|_next/image|favicon.ico|_not-found|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
