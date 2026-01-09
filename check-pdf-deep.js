
try {
    const pdf = require('pdf-parse/lib/pdf-parse.js');
    console.log('require(lib/pdf-parse):', typeof pdf);
} catch (e) {
    console.log('require(lib/pdf-parse) failed:', e.message);
}

try {
    const pdf = require('pdf-parse/index.js');
    console.log('require(index.js):', typeof pdf);
} catch (e) {
    console.log('require(index.js) failed:', e.message);
}
