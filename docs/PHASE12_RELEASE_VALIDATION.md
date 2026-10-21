# Phase 12 — final release gate and recovery acceptance

**Status: blocked until developer/device evidence exists.** This phase separates routine code verification from real production publishing. It does **not** approve a signed Android release or certify Firebase security.

## What changes now

- Pushing `main` or opening a pull request runs **Verify My Diary Changes**; it no longer publishes the public site.
- Production publishing requires manually running **Deploy to GitHub Pages** on the `main` branch and typing `DEPLOY_APPROVED`. The job targets the GitHub `diary-production` environment. **Configure that environment with required reviewers in Settings → Environments**; defining a name in a workflow alone does not automatically require a human reviewer.
- `node scripts/phase12-release-gates.mjs` reports deterministic source-level blockers without touching Firebase or Android. `--strict` returns a nonzero status for blocked gates; `--json` returns non-sensitive machine-readable results.
- This does **not** deploy Firestore rules. Always review/deploy rules separately and run the Phase 11 emulator suite before claiming an owner-only security verdict.

## Before attempting the next production deployment

1. On a connected development machine, from the complete source directory, regenerate dependencies and commit the lockfile:
   ```sh
   npm install @capacitor/filesystem@^8 @capacitor/share@^8
   node scripts/phase12-release-gates.mjs --strict
   npm ci
   npm run lint && npm test && npm run build && npm run verify:dist
   npx cap sync android
   cd android && ./gradlew :app:assembleDebug
   ```
   Never hand-edit the lockfile just to satisfy preflight. The synthetic test fixture does not change the actual project lockfile.
2. In a local Firebase emulator configured with the `demo-diary-acceptance` project, run the Phase 11 acceptance suite and preserve its output. The static rules scan is insufficient.
3. In a **separate** staging Firebase project, verify owner-only rules and a full synthetic/approved sanitized backup restore. Recheck restored document values from the server and confirm replay does not overwrite them.
4. On an Android phone, upgrade without uninstalling or clearing data; verify native vault durability across a restart, pending offline edits, memory-cache cutover, Calendar PNG save, JSON backup delivery, Book/Game/Journal updates and conflict reporting. Export and inspect a full private backup BEFORE migration.
5. Capture actual Android frame traces for timer reveal, cover transition, long Library scroll, and Insights interactions. Record device model and refresh rate. No frame rates were measured in this environment.
6. Complete `npm run release:status -- --template` evidence and independently review actual results. Use `--check` only after recording real evidence. **Do not type DEPLOY_APPROVED before a genuine release decision.**

## Known release blockers at handoff

- `package-lock.json` still lacks `@capacitor/filesystem` and `@capacitor/share`. npm registry access was unavailable in this environment (DNS EAI_AGAIN); full `npm ci`/Vite build cannot be certified here.
- Real Firebase Emulator, live staging permissions, full backup recovery, and actual Android APK/Keystore/MediaStore/frame testing have **not** been completed by this phase.
- Older local plaintext recovery records and legacy Firestore IndexedDB data require a staged device-specific migration decision; do not purge storage automatically.
- The deploy workflow requires **GitHub environment reviewers** to be configured by the repository owner for an additional approval boundary.

## Rollback guidance

If the new GitHub Pages workflow is not configured, no deployment will occur automatically. The owner can revert workflow changes through version control, but should only re-enable automatic publishing after the release policy is explicitly approved. Avoid downgrading an Android build that has migrated storage into the private vault without first verifying restoration from an independent backup.
