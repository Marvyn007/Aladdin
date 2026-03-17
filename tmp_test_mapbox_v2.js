
import fetch from 'node-fetch';

const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

async function testQuery(query, types) {
    console.log(`\nTesting Query: "${query}" (types: ${types})`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=5&types=${types}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.features) {
        data.features.forEach((f, i) => {
            console.log(`Result ${i+1}:`);
            console.log(`  Label: ${f.place_name}`);
            console.log(`  ID: ${f.id}`);
            console.log(`  Coordinates: ${f.center[1]}, ${f.center[0]}`);
        });
    } else {
        console.log('No features found.');
    }
}

async function main() {
    if (!token) {
        console.error('No Mapbox token found in environment.');
        return;
    }
    await testQuery('San Francisco, CA', 'place,locality');
    await testQuery('San Francisco, CA', 'address,poi,locality');
}

main();
