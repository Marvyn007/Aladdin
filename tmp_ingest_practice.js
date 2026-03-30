const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();
const GITHUB_REPO_URL = 'https://api.github.com/repos/snehasishroy/leetcode-companywise-interview-questions/contents/';
const RAW_BASE_URL = 'https://raw.githubusercontent.com/snehasishroy/leetcode-companywise-interview-questions/master/';

function parseCSVRow(row) {
    const matches = row.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
    if (!matches || matches.length < 6) return null;
    const [id, url, title, difficulty, acceptance, frequency] = matches.map(m => m.replace(/^"|"$/g, '').trim());
    return {
        number: parseInt(id),
        url,
        title,
        difficulty,
        acceptanceRate: parseFloat(acceptance.replace('%', '')),
        frequency: parseFloat(frequency.replace('%', ''))
    };
}

async function ingest() {
    try {
        console.log('Fetching company list from GitHub...');
        const contentsResponse = await fetch(GITHUB_REPO_URL, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Aladdin-App'
            }
        });
        const items = await contentsResponse.json();
        const companies = items
            .filter(item => item.type === 'dir' && !item.name.startsWith('.'))
            .map(item => item.name);

        console.log(`Found ${companies.length} companies.`);

        // For testing, let's just do top 5 companies first
        const targetCompanies = companies.slice(0, 5);
        console.log('Ingesting: ', targetCompanies.join(', '));

        for (const company of targetCompanies) {
            console.log(`Processing ${company}...`);
            const csvUrl = `${RAW_BASE_URL}${encodeURIComponent(company)}/all.csv`;
            const csvResponse = await fetch(csvUrl);
            if (!csvResponse.ok) continue;

            const csvText = await csvResponse.text();
            const rows = csvText.replace(/\r/g, '').split('\n').slice(1);

            for (const row of rows) {
                if (!row.trim()) continue;
                const data = parseCSVRow(row);
                if (!data) continue;

                const question = await prisma.leetCodeQuestion.upsert({
                    where: { number: data.number },
                    update: {
                        title: data.title,
                        url: data.url,
                        difficulty: data.difficulty,
                        acceptanceRate: data.acceptanceRate ?? null,
                    },
                    create: {
                        number: data.number,
                        title: data.title,
                        url: data.url,
                        difficulty: data.difficulty,
                        acceptanceRate: data.acceptanceRate ?? null,
                    }
                });

                await prisma.companyLeetCodeQuestion.upsert({
                    where: {
                        companyName_questionId: {
                            companyName: company,
                            questionId: question.id
                        }
                    },
                    update: { frequency: data.frequency },
                    create: {
                        companyName: company,
                        questionId: question.id,
                        frequency: data.frequency
                    }
                });
            }
        }
        console.log('Ingestion complete.');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

ingest();
