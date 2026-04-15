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
 * then `prisma.applyPilotProfile` (etc.) is undefined at runtime.
 */
if (typeof (prisma as unknown as { applyPilotProfile?: unknown }).applyPilotProfile === 'undefined') {
    void prisma.$disconnect().catch(() => {});
    prisma = createPrismaClient();
    if (process.env.NODE_ENV !== 'production') {
        globalThis.__prisma = prisma;
    }
}

export { prisma };
