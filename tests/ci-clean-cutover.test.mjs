import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const workflowPath = path.resolve(__dirname, '../.github/workflows/deploy.yml');
const gitignorePath = path.resolve(__dirname, '../.gitignore');

test('TC-01: package.json defines test and check automation scripts (Section 12.5)', async () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    assert.ok(pkg.scripts, 'package.json must contain scripts');
    assert.equal(
        pkg.scripts.test,
        'node --test tests/*.test.mjs',
        'package.json must define "test": "node --test tests/*.test.mjs"'
    );
    assert.ok(
        pkg.scripts.check && pkg.scripts.check.includes('lint') && pkg.scripts.check.includes('test') && pkg.scripts.check.includes('build'),
        'package.json must define "check" script running lint, test, and build'
    );
});

test('TC-02: .github/workflows/deploy.yml implements automated Lint and Test quality gates (Section 12.5)', async () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(
        workflow.includes('npm run lint'),
        '.github/workflows/deploy.yml must execute "npm run lint"'
    );
    assert.ok(
        workflow.includes('npm run test') || workflow.includes('npm test'),
        '.github/workflows/deploy.yml must execute "npm test"'
    );

    // Verify ordering: Lint and Test must appear before Build step
    const lintIndex = workflow.indexOf('npm run lint');
    const testIndex = workflow.indexOf('npm test') !== -1 ? workflow.indexOf('npm test') : workflow.indexOf('npm run test');
    const buildIndex = workflow.indexOf('npm run build');

    assert.ok(lintIndex !== -1 && lintIndex < buildIndex, 'Lint step must precede Build step');
    assert.ok(testIndex !== -1 && testIndex < buildIndex, 'Test step must precede Build step');
});

test('TC-03: .gitignore permits tracking of tests/ and docs/ while ignoring private archives and secrets', async () => {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');

    // tests/ and docs/ must NOT be ignored
    const lines = gitignore.split(/\r?\n/).map(l => l.trim());
    assert.ok(
        !lines.includes('tests/') && !lines.includes('tests'),
        '.gitignore must NOT ignore the tests/ directory'
    );
    assert.ok(
        !lines.includes('docs/') && !lines.includes('docs'),
        '.gitignore must NOT ignore the docs/ directory'
    );
    assert.ok(
        !lines.includes('*.md'),
        '.gitignore must NOT broadly ignore *.md files'
    );

    // Private files MUST remain ignored
    assert.ok(
        gitignore.includes('.env'),
        '.gitignore must continue to ignore .env files'
    );
    assert.ok(
        gitignore.includes('node_modules/'),
        '.gitignore must continue to ignore node_modules/'
    );
    assert.ok(
        gitignore.includes('dist/'),
        '.gitignore must continue to ignore dist/'
    );
    assert.ok(
        gitignore.includes('legacy-books-archive.json') || gitignore.includes('scripts/legacy-books-archive.json'),
        '.gitignore must explicitly ignore private legacy-books-archive.json'
    );
});
