const fs = require('fs');
const path = require('path');

// Use the web-ifc version that matches @thatopen/components
const files = [
  'node_modules/web-ifc/web-ifc.wasm',
  'node_modules/web-ifc/web-ifc-mt.wasm',
];

const outDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const f of files) {
  const src = path.join(__dirname, '..', f);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(outDir, path.basename(f));
  fs.copyFileSync(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
}

console.log('WASM copy complete.');
