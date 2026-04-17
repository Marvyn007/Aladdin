import { PrismaClient } from '@prisma/client';

declare global {
    var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
    return new PrismaClient();
}

let prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = prisma;
}

/**
 * Dev HMR can keep a PrismaClient that was instantiated before `prisma generate` added a model;
 * then newly added delegates (e.g. contactSearchCache) are undefined at runtime.
 * Check for the most recently added model to detect a stale client.
 */
type PrismaWithExtras = { applyPilotProfile?: unknown; contactSearchCache?: unknown };
if (
    typeof (prisma as unknown as PrismaWithExtras).applyPilotProfile === 'undefined' ||
    typeof (prisma as unknown as PrismaWithExtras).contactSearchCache === 'undefined'
) {
    void prisma.$disconnect().catch(() => {});
    prisma = createPrismaClient();
    if (process.env.NODE_ENV !== 'production') {
        globalThis.__prisma = prisma;
    }
}

export { prisma };
