import { readFileSync } from 'node:fs';

const required = ['VITE_OWNER_UID', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_APP_ID'];
const missing = required.filter((name) => !String(process.env[name] || '').trim());
if (missing.length) {
    console.error('Missing required GitHub Actions secrets: ' + missing.join(', '));
    process.exitCode = 1;
} else {
    const rules = readFileSync('firestore.rules', 'utf8');
    const match = rules.match(/function isOwner\(uid\)[\s\S]*?uid == '([^']+)'/);
    if (!match) {
        console.error('Unable to identify owner UID from firestore.rules. Review rules before deploying.');
        process.exitCode = 1;
    } else if (process.env.VITE_OWNER_UID.trim() !== match[1]) {
        console.error('VITE_OWNER_UID does not match the owner UID in firestore.rules. Refusing to build a mismatched client.');
        process.exitCode = 1;
    } else {
        console.log('Firebase project identifiers and owner UID are present and locally consistent.');
        console.log('This does NOT confirm that the rules are deployed to Firebase.');
    }
}
