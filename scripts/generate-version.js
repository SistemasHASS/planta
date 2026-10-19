// Genera src/app/version.ts y public/sw-version.js a partir de la "version" del package.json.
// Corre solo antes de `npm start` y `npm run build` (ver "prestart" y "prebuild").
// Para publicar una version nueva: cambiar "version" en package.json.
const fs = require('fs');

const { version } = require('../package.json');

fs.writeFileSync('src/app/version.ts', `export const APP_VERSION = '${version}';`);
fs.writeFileSync('public/sw-version.js', `const APP_VERSION = '${version}';`);

console.log(`Version de la aplicacion: ${version}`);
