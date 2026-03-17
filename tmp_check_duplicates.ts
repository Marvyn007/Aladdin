
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    try {
        const companies = await prisma.company.findMany();
        console.log('Total companies:', companies.length);
        
        const clearbit = companies.filter(c => c.logoUrl?.includes('clearbit'));
        console.log('Clearbit logos:', clearbit.length);
        if (clearbit.length > 0) {
            console.log('Sample clearbit:', clearbit.slice(0, 10).map(c => ({ name: c.name, logoUrl: c.logoUrl })));
        }
        
        const logoDev = companies.filter(c => c.logoUrl?.includes('logo.dev'));
        console.log('Logo.dev logos:', logoDev.length);

        // Check for duplicates (case-insensitive name)
        const names = companies.map(c => c.name.toLowerCase());
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
        console.log('Duplicate names (case-insensitive):', [...new Set(duplicates)]);

    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

check();
