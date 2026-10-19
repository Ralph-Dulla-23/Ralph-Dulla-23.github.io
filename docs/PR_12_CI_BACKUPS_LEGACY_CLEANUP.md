# PR 12: CI, Backups and Legacy Cleanup

## 1. Overview & Specification Alignment

### Background & Requirements
As specified in Section 13 (PR 12) and Section 16 (Definition of Done) of `DIARY_STABILIZATION_IMPLEMENTATION.md`:
1. **Automated CI Quality Gates**:
   - `package.json` must provide standardized scripts:
     - `"test": "node --test tests/*.test.mjs"` to execute all repository unit and regression suites.
     - `"check": "npm run lint && npm run test && npm run build"` for full one-command verification prior to pushes or deployments.
   - `.github/workflows/deploy.yml` must enforce linting (`npm run lint`) and testing (`npm test`) steps prior to production deployment (`npm run build`). A failed test or lint violation will immediately halt CI and prevent broken bundles from reaching production.
2. **Version Control Tracking & Backup Hygiene (`.gitignore`)**:
   - The repository previously ignored `tests/`, `docs/`, and `*.md`, which posed a major CI risk: clean GitHub Actions runners would checkout zero tests and deploy blindly.
   - Broad ignore rules for `tests/`, `docs/`, and `*.md` must be removed so all test suites and architectural documentation are fully tracked in Git.
   - Sensitive private user archives, backup snapshots, and local exports must remain strictly excluded:
     - `scripts/legacy-books-archive.json`
     - `diary-backup-*.json`
     - `*.backup*.json`
     - `*user-export*.json`

---

## 2. Changes Made

### 2.1 Configuration & Workflow Layer
- **`package.json`**:
  - Added `"test": "node --test tests/*.test.mjs"`.
  - Added `"check": "npm run lint && npm run test && npm run build"`.
- **`.github/workflows/deploy.yml`**:
  - Inserted automated `Lint` step (`npm run lint`) before build.
  - Inserted automated `Test` step (`npm test`) before build.
- **`.gitignore`**:
  - Removed lines ignoring `tests/`, `docs/`, and `*.md`.
  - Added explicit patterns to prevent committing private user data:
    ```gitignore
    # Private user backups, archives, and exports
    scripts/legacy-books-archive.json
    diary-backup-*.json
    *.backup*.json
    *user-export*.json
    ```

### 2.2 Automated Tests (`tests/ci-clean-cutover.test.mjs`)
- Created automated test suite verifying:
  - **TC-01**: `package.json` defines `"test"` and `"check"` scripts matching specification.
  - **TC-02**: `.github/workflows/deploy.yml` includes lint and test steps before build.
  - **TC-03**: `.gitignore` tracks tests/docs while excluding sensitive user archives and backups.

---

## 3. Verification & Evidence

- **Automated PR 12 Tests**: `node --test tests/ci-clean-cutover.test.mjs` → **3/3 PASS**
- **Full CI Check (`npm run check`)**:
  - **Lint**: `npm run lint` → Clean (0 errors, 0 warnings).
  - **Test**: `npm test` → **169/169 PASS** across 30 test suites (818ms).
  - **Build**: `npm run build` → Clean bundle in `dist/`, 749 modules transformed in 9.81s.
- **Git Tracking Verification**: `git status` confirms `tests/`, `docs/`, and stabilization markdown files are tracked, while `scripts/legacy-books-archive.json` remains ignored.

---

## 4. Rollback Plan
If any regressions arise in CI runner environments:
1. CI workflow steps can be temporarily bypassed by reverting `.github/workflows/deploy.yml`.
2. Package scripts in `package.json` are additive and do not alter existing developer workflows.
3. `.gitignore` modifications ensure clean file separation without risking sensitive data leaks.
