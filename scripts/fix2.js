const fs = require('fs');
let c = fs.readFileSync('src/lib/gemini-jd-strict.ts', 'utf8');
c = c.split('\\`').join('`');
fs.writeFileSync('src/lib/gemini-jd-strict.ts', c);
