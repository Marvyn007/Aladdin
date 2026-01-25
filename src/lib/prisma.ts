/**
 * Prisma Client Singleton for Next.js
 * Prevents multiple instances during hot-reloading in development
 */

import { PrismaClient } from '@prisma/client';

// Add prisma to the global type
declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

// Create a singleton instance
const prisma = global.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// In development, store the client on the global object
if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}

export default prisma;

// Helper to check Prisma connection
export async function checkPrismaConnection(): Promise<boolean> {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch (error) {
        console.error('Prisma connection failed:', error);
        return false;
    }
}

// Helper to disconnect Prisma
export async function disconnectPrisma(): Promise<void> {
    await prisma.$disconnect();
}
