const fs = require('fs');
try {
    const content = fs.readFileSync('models.json', 'utf8');
    // It might be UTF-16LE, let's try to handle that if 'utf8' fails to produce valid JSON
    // but let's try stripping BOM if present
    const json = JSON.parse(content.replace(/^\uFEFF/, ''));
    console.log(json.models.map(m => m.name).join('\n'));
} catch (e) {
    // If utf8 failed, try reading as buffer and converting
    console.error('Error:', e.message);
}
