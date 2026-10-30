import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkPhase12ReleaseSource } from '../scripts/phase12-release-gates.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (name) => {
  const target = resolve(root, name);
  return existsSync(target) ? readFileSync(target, 'utf8') : '// synthetic stub\n';
};

const required = [
  '.github/workflows/deploy.yml', '.github/workflows/verify.yml',
  'package.json', 'package-lock.json', 'firestore.rules', 'firebase.json',
  'android/gradlew', 'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/java/com/ralph/diary/MainActivity.java',
  'scripts/phase11-emulator-acceptance.mjs',
  'scripts/verify-private-source.mjs', 'scripts/verify-release-assets.mjs',
];

function fixture(callback) {
  const dir = mkdtempSync(resolve(tmpdir(), 'diary-release-gate-'));
  try {
    for (const file of required) {
      const dest = resolve(dir, file);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, source(file));
    }
    return callback(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('Push and PR verification cannot trigger a production deployment', () => {
  const deploy = source('.github/workflows/deploy.yml');
  const ci = source('.github/workflows/verify.yml');
  assert.match(deploy, /workflow_dispatch:/);
  assert.doesNotMatch(deploy, /^  push:/m);
  assert.match(deploy, /inputs\.confirm_production == 'DEPLOY_APPROVED'/);
  assert.match(deploy, /name: diary-production/);
  assert.match(ci, /^  push:/m);
  assert.match(ci, /^  pull_request:/m);
  assert.doesNotMatch(ci, /github-pages-deploy-action/);
});

test('Read-only gate rejects automated production publication and missing approval', () => fixture(dir => {
  const path = resolve(dir, '.github/workflows/deploy.yml');
  const original = readFileSync(path, 'utf8').replace(/\r?\n/g, '\n');
  writeFileSync(path, original.replace('  workflow_dispatch:\n', '  push:\n    branches: [main]\n  workflow_dispatch:\n'));
  assert.equal(checkPhase12ReleaseSource(dir).checks.find(c => c.id === 'manual-production-only').status, 'block');
  writeFileSync(path, original.replace("inputs.confirm_production == 'DEPLOY_APPROVED'", 'true'));
  assert.equal(checkPhase12ReleaseSource(dir).checks.find(c => c.id === 'manual-production-only').status, 'block');
}));

test('Gate identifies stale lockfile instead of certifying npm ci', () => fixture(dir => {
  const lockPath = resolve(dir, 'package-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  delete lock.packages['']['dependencies']['@capacitor/filesystem'];
  delete lock.packages['']['dependencies']['@capacitor/share'];
  delete lock.packages['node_modules/@capacitor/filesystem'];
  delete lock.packages['node_modules/@capacitor/share'];
  writeFileSync(lockPath, JSON.stringify(lock));
  const before = checkPhase12ReleaseSource(dir);
  const lockCheck = before.checks.find(c => c.id === 'npm-lock-consistency');
  assert.equal(lockCheck.status, 'block');
  assert.match(lockCheck.message, /@capacitor\/filesystem/);
  assert.match(lockCheck.message, /@capacitor\/share/);
}));

test('Gate recognizes correctly locked manifest in a non-production synthetic fixture', () => fixture(dir => {
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(dir, 'package-lock.json'), 'utf8'));
  for (const [section, values] of Object.entries({dependencies: pkg.dependencies, devDependencies: pkg.devDependencies})) {
    for (const [name, version] of Object.entries(values)) {
      lock.packages[''][section][name] = version;
      lock.packages[`node_modules/${name}`] ||= {version: '0.0.0-test-fixture'};
    }
  }
  writeFileSync(resolve(dir, 'package-lock.json'), JSON.stringify(lock));
  const result = checkPhase12ReleaseSource(dir);
  assert.equal(result.overall, 'source-gates-pass');
}));

test('Strict CLI exits nonzero on blocked release gate', () => fixture(dir => {
  const deployPath = resolve(dir, '.github/workflows/deploy.yml');
  const original = readFileSync(deployPath, 'utf8').replace(/\r?\n/g, '\n');
  writeFileSync(deployPath, original.replace("inputs.confirm_production == 'DEPLOY_APPROVED'", 'true'));
  const scriptPath = resolve(root, 'scripts/phase12-release-gates.mjs');
  const result = spawnSync(process.execPath, [scriptPath, '--strict'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /BLOCK/);
  assert.doesNotMatch(result.stdout, /source-gates-pass/);
}));
