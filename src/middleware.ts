import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isAdminRoute = createRouteMatcher(['/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
    if (isAdminRoute(req)) {
        const { userId, sessionClaims } = await auth();

        // Not signed in → redirect to sign-in with return URL
        if (!userId) {
            const signInUrl = new URL('/sign-in', req.url);
            signInUrl.searchParams.set('redirect_url', req.url);
            return NextResponse.redirect(signInUrl);
        }

        // Signed in but not admin → rewrite to /not-found (404, URL unchanged)
        const role = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
        if (role !== 'admin') {
            return NextResponse.rewrite(new URL('/not-found', req.url));
        }
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and static files
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
