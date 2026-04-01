import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId } = await auth()

  // Fire-and-forget activity tracking for authenticated users
  // Skip tracking the touch endpoint itself to avoid loops
  if (userId && !req.nextUrl.pathname.startsWith('/api/user/touch')) {
    fetch(new URL('/api/user/touch', req.url), {
      method: 'POST',
      headers: { cookie: req.headers.get('cookie') ?? '' },
    }).catch(() => {
      // Intentionally fire-and-forget — never block the response
    })
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
