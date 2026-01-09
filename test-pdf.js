const pdf = require('pdf-parse');
const fs = require('fs');

console.log('pdf-parse required successfully');

// Create a dummy PDF buffer (header only)
const dummyPdf = Buffer.from('%PDF-1.4\n%...');

pdf(dummyPdf).then(data => {
    console.log('Parsed text:', data.text);
}).catch(err => {
    console.error('Parse error:', err);
});
