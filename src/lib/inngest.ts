import { Inngest } from 'inngest'

const DEV_SERVER_URL = 'http://localhost:8288';

export function getInngestConfig() {
  const isDev = process.env.NODE_ENV !== 'production';
  const explicitUrl = process.env.INNGEST_BASE_URL;
  return {
    id: 'aladdin-job-crawler',
    eventKey: process.env.INNGEST_EVENT_KEY,
    signingKey: process.env.INNGEST_SIGNING_KEY,
    baseUrl: explicitUrl ?? (isDev ? DEV_SERVER_URL : undefined),
  };
}

export const inngest = new Inngest(getInngestConfig())
