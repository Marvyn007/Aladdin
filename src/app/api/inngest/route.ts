import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { crawlerTick, crawlerProcessTask } from '@/inngest/crawler'

/**
 * Inngest serve endpoint — /api/inngest
 *
 * Inngest Cloud calls this endpoint to:
 *   • Discover registered functions (GET)
 *   • Invoke function steps (POST)
 *   • Verify webhook signatures (PUT)
 *
 * maxDuration: 300 seconds (Vercel Pro/Enterprise max).
 * Each step.run() call is independently billed against Vercel's function
 * timeout — steps exceeding 60s on Hobby will fail, but Inngest retries them.
 *
 * Local dev: POST step execution fails with 401 if `INNGEST_SIGNING_KEY` here
 * does not match the key used by `inngest dev` (set the same value in your
 * shell before starting the CLI, or restart the CLI after updating .env.local).
 */
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [crawlerTick, crawlerProcessTask],
})
