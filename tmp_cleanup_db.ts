
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
    try {
        console.log('Starting database cleanup...');
        const companies = await prisma.company.findMany();
        
        console.log(`Processing ${companies.length} companies...`);
        
        for (const company of companies) {
            if (company.logoUrl && company.logoUrl.includes('clearbit')) {
                const newUrl = `https://img.logo.dev/${company.domain || company.name.toLowerCase().replace(/ /g, '') + '.com'}`;
                await prisma.company.update({
                    where: { id: company.id },
                    data: { logoUrl: newUrl }
                });
            }
        }
        
        console.log('Updated all Clearbit URLs to logo.dev.');

        // Deduplicate nvidia and ebay
        const dupes = ['nvidia', 'ebay'];
        for (const name of dupes) {
            const records = await prisma.company.findMany({
                where: { name: { contains: name, mode: 'insensitive' } }
            });
            
            if (records.length > 1) {
                console.log(`Deduplicating ${name}...`);
                // Keep the one with more information or just the first one
                const keep = records[0];
                const toDelete = records.slice(1);
                
                for (const record of toDelete) {
                    // Update any interview experiences pointing to the duplicate
                    await prisma.interviewExperience.updateMany({
                        where: { companyName: record.name },
                        data: { companyName: keep.name }
                    });
                    
                    await prisma.company.delete({
                        where: { id: record.id }
                    });
                }
            }
        }
        
        console.log('Deduplication complete.');

    } catch (error) {
        console.error('Cleanup failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanup();
