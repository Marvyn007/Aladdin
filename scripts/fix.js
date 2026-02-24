const fs = require('fs');
let c = fs.readFileSync('scripts/test-jd-parser.ts', 'utf8');
c = c.split('\\`').join('`');
fs.writeFileSync('scripts/test-jd-parser.ts', c);
