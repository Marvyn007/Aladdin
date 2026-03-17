
async function checkApi() {
    try {
        const url = 'http://localhost:3000/api/interview-experiences?page=1&limit=15&sort_by=most_reviews';
        console.log(`Calling ${url}...`);
        const res = await fetch(url);
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text}`);
    } catch (error) {
        console.error('Fetch failed:', error);
    }
}

checkApi();
