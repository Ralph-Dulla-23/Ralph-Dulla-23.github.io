#!/usr/bin/env node
/** Read-only Phase 12 release gate. Detects blockers; NEVER deploys or certifies an APK.
 * Deterministic source checks run without node_modules or Firebase credentials. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const from = (root, path) => resolve(root, path);
const read = (root, path) => readFileSync(from(root, path), 'utf8');

export function checkPhase12ReleaseSource(root) {
  const items = [];
  const check = (id, ok, message) => items.push({ id, status: ok ? 'pass' : 'block', message });
  const file = (path) => existsSync(from(root, path));
  const workflow = '.github/workflows/deploy.yml';
  const deploy = file(workflow) ? read(root, workflow) : '';
  // This check is intentionally conservative: never treat workflow_dispatch
  // alone as an approval gate when a push trigger still publishes the site.
  check('manual-production-only',
    /^\s{2}workflow_dispatch:\s*$/m.test(deploy)
    && !/^\s{2}(push|pull_request|schedule|repository_dispatch):\s*$/m.test(deploy)
    && /github\.ref == 'refs\/heads\/main'/.test(deploy)
    && /inputs\.confirm_production == 'DEPLOY_APPROVED'/.test(deploy)
    && /environment:\s*\n\s+name: diary-production/.test(deploy),
    'Production publishing must be manual, require DEPLOY_APPROVED on main, and target the diary-production environment.');

  const ci = '.github/workflows/verify.yml';
  const verify = file(ci) ? read(root, ci) : '';
  check('non-deploying-source-ci',
    /^\s{2}push:\s*$/m.test(verify) && /^\s{2}pull_request:\s*$/m.test(verify)
    && /npm ci/.test(verify) && /npm test/.test(verify)
    && !/github-pages-deploy-action/.test(verify),
    'Pull requests and main pushes should run verification without publishing.');

  const manifest = file('package.json') ? JSON.parse(read(root, 'package.json')) : null;
  const lock = file('package-lock.json') ? JSON.parse(read(root, 'package-lock.json')) : null;
  const missing = [];
  if (manifest && lock) {
    for (const section of ['dependencies','devDependencies']) {
      for (const [name, range] of Object.entries(manifest[section] || {})) {
        if (lock.packages?.['']?.[section]?.[name] !== range || !lock.packages?.[`node_modules/${name}`]) missing.push(name);
      }
    }
  }
  check('npm-lock-consistency', !!manifest && !!lock && missing.length === 0,
    missing.length ? `Regenerate package-lock.json using npm install; mismatched packages: ${missing.join(', ')}.`
      : 'Both package.json and package-lock.json must have matching dependency entries.');

  const required = [
    'firestore.rules', 'firebase.json', 'android/gradlew',
    'android/app/src/main/AndroidManifest.xml',
    'android/app/src/main/java/com/ralph/diary/DiarySecureVaultPlugin.java',
    'scripts/phase11-emulator-acceptance.mjs',
    'scripts/verify-private-source.mjs',
    'scripts/verify-release-assets.mjs',
  ];
  const missingFiles = required.filter(p => !file(p));
  check('required-release-assets', missingFiles.length === 0,
    missingFiles.length ? `Missing: ${missingFiles.join(', ')}` : 'Security, Android, restore and publishing checks present.');
  return { overall: items.every(x => x.status === 'pass') ? 'source-gates-pass' : 'blocked', checks: items };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const result = checkPhase12ReleaseSource(root);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const item of result.checks) console.log(`${item.status === 'pass' ? 'PASS' : 'BLOCK'} ${item.id}: ${item.message}`);
    console.log(`Phase 12 SOURCE gate: ${result.overall}. Android/Firebase staging acceptance is separate.`);
  }
  if (process.argv.includes('--strict') && result.overall !== 'source-gates-pass') process.exitCode = 1;
}
