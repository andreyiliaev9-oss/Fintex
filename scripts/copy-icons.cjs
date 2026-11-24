const fs = require('node:fs');
fs.mkdirSync('assets', { recursive: true });
fs.copyFileSync('node_modules/lucide/dist/umd/lucide.min.js', 'assets/icons.js');
fs.copyFileSync('node_modules/lucide/LICENSE', 'assets/icons.LICENSE');
