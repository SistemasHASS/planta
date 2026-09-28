const fs = require('fs');

const packageJson = require('../package.json');

const version = packageJson.version;

const contenido = `
export const APP_VERSION = '${version}';
`;

fs.writeFileSync('src/app/version.ts', contenido);

const swVersion = `const APP_VERSION = '${version}';`;

fs.writeFileSync('public/sw-version.js', swVersion);


console.log(`
==============================================================

  ██████  ██       █████  ███    ██ ████████  █████
  ██   ██ ██      ██   ██ ████   ██    ██    ██   ██
  ██████  ██      ███████ ██ ██  ██    ██    ███████
  ██      ██      ██   ██ ██  ██ ██    ██    ██   ██
  ██      ███████ ██   ██ ██   ████    ██    ██   ██

               P L A N T A  -  E M P A Q U E
                         v${version}

==============================================================
`);