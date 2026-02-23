import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting explicit logo update...');
    const logoUpdates = [
        { name: 'Abbott Laboratories', url: 'https://logo.clearbit.com/abbott.com' },
        { name: 'American Marketing Association', url: 'https://logo.clearbit.com/ama.org', search: 'amaeican' },
        { name: 'Berkshire Hathaway', url: 'https://www.google.com/s2/favicons?domain=berkshirehathaway.com&sz=128' },
        { name: 'daallo Airlines', url: 'https://www.google.com/s2/favicons?domain=daallo.com&sz=128' },
        { name: 'East Japan Railway Company', url: 'https://www.google.com/s2/favicons?domain=jreast.co.jp&sz=128' },
        { name: 'FFJDR', url: 'https://www.google.com/s2/favicons?domain=ffjdr.org&sz=128' },
        { name: 'Palo Alto Networks', url: 'https://logo.clearbit.com/paloaltonetworks.com' },
        { name: 'Somenek+PittmanMD', url: 'https://www.google.com/s2/favicons?domain=somenekpittmanmd.com&sz=128', search: 'Somenek' },
        { name: 'Sompo Japan', url: 'https://www.google.com/s2/favicons?domain=sompo-japan.co.jp&sz=128' },
        { name: 'XPRICE', url: 'https://logo.clearbit.com/xprice.co.jp' }
    ];

    for (const update of logoUpdates) {
        const searchName = update.search || update.name.split(' ')[0];
        const companies = await prisma.company.findMany();
        const company = companies.find(c => c.name.toLowerCase().includes(searchName.toLowerCase()));

        if (company) {
            await prisma.company.update({
                where: { id: company.id },
                data: {
                    logoUrl: update.url,
                    logoFetched: true,
                    domain: new URL(update.url.includes('favicons') ? 'https://' + new URLSearchParams(update.url.split('?')[1]).get('domain') : update.url).hostname.replace('logo.clearbit.com', '')
                }
            });
            console.log(`Updated: ${company.name} with ${update.url}`);
        } else {
            console.log(`Not found in DB: ${update.name} (Search term used: ${searchName})`);
        }
    }
    console.log('Finished explicit logo update.');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
