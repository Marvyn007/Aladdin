
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    try {
        console.log('Fetching companies...');
        const companies = await prisma.company.findMany({
            include: {
                interviewExperiences: {
                    select: {
                        salaryHourly: true
                    }
                }
            }
        });
        console.log(`Successfully fetched ${companies.length} companies.`);
        if (companies.length > 0) {
            console.log('Sample company:', JSON.stringify({
                name: companies[0].name,
                reviewCount: companies[0].interviewExperiences.length
            }, null, 2));
        }
    } catch (error) {
        console.error('Error fetching companies:', error);
    } finally {
        await prisma.$disconnect();
    }
}

test();
