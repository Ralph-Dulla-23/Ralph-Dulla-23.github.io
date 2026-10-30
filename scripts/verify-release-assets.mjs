import fs from 'node:fs';
import path from 'node:path';

const requiredAssets = [
    'index.html',
    'package.json',
    'firestore.rules',
    'src/App.jsx',
    'src/main.jsx',
    'src/index.css',
    'capacitor.config.json',
];

let missing = 0;
for (const rel of requiredAssets) {
    const full = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(full)) {
        console.error(`FAIL verify-release-assets: Missing required asset ${rel}`);
        missing++;
    }
}

if (missing === 0) {
    console.log(`PASS verify-release-assets: All ${requiredAssets.length} core release source assets verified.`);
} else {
    process.exitCode = 1;
}
