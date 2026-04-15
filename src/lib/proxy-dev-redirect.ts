/**
 * In development we redirect 127.0.0.1 → localhost for Clerk cookie consistency.
 * Skip that for Inngest: the dev executor calls the app with a signed payload tied
 * to the request URL/host; redirecting breaks signature verification (401).
 */
export function shouldSkipLocalHostCanonicalRedirect(pathname: string): boolean {
  return pathname === '/api/inngest' || pathname.startsWith('/api/inngest/');
}
