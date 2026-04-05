import { Inngest } from 'inngest'

// ── Inngest client ──
// All crawler functions share this single client instance.
// Event types are inferred from the functions that use this client.

export const inngest = new Inngest({
  id: 'aladdin-job-crawler',
})
