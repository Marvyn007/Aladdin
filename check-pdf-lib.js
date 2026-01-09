
try {
    const pdf = require('pdf-parse');
    console.log('pdf type:', typeof pdf);
} catch (e) {
    console.error('pdf-parse load failed:', e);
}
