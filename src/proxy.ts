import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define protected routes that require authentication
// We now allow public access by default to everything (public-first)
const isProtectedRoute = createRouteMatcher([
    '/api/application(.*)', // Tracker API
    '/api/resume(.*)',      // Resume API
    '/api/cover-letter(.*)', // Cover Letter API
    '/api/upload(.*)',      // Upload API
    '/api/settings(.*)',    // User settings
    '/api/run-scoring',     // Job scoring
    '/api/run-import',      // Job import
    '/api/add-bookmark',    // Bookmarks
]);

export default clerkMiddleware(async (auth, req) => {
    console.log(`[Proxy] Request hitting: ${req.nextUrl.pathname}`);
    const { userId } = await auth();

    // Redirect authenticated users away from sign-in/sign-up pages
    const isAuthRoute = req.nextUrl.pathname.startsWith('/sign-in') || req.nextUrl.pathname.startsWith('/sign-up');
    if (isAuthRoute && userId) {
        return NextResponse.redirect(new URL('/', req.url));
    }

    // If it's a protected route, check auth
    if (isProtectedRoute(req)) {
        if (!userId) {
            if (req.nextUrl.pathname.startsWith('/api')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const signInUrl = new URL('/sign-in', req.url);
            signInUrl.searchParams.set('redirect_url', req.url);
            return NextResponse.redirect(signInUrl);
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
