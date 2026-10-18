import fs from 'fs';
import readline from 'readline';
import dns from 'dns';

// Ensure IPv4 first to avoid Windows IPv6 EACCES socket errors
dns.setDefaultResultOrder('ipv4first');

// Read .env for Firebase config
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [k, ...v] = trimmed.split('=');
    env[k.trim()] = v.join('=').trim();
});

const apiKey = env.VITE_FIREBASE_API_KEY;
const projectId = env.VITE_FIREBASE_PROJECT_ID;
const ownerUid = env.VITE_OWNER_UID;

if (!apiKey || !projectId || !ownerUid) {
    console.error('Missing Firebase configuration in .env!');
    process.exit(1);
}

// 51 books
const booksData = JSON.parse(
    fs.readFileSync(
        'C:/Users/dulla/.gemini/antigravity/brain/03fd88e9-9930-4576-b18d-61ad3d90a2c2/scratch/all_51_books.json',
        'utf8'
    )
);

function toFirestoreFields(obj) {
    const fields = {};
    for (const [key, val] of Object.entries(obj)) {
        if (val === undefined || val === null) {
            fields[key] = { nullValue: null };
        } else if (typeof val === 'string') {
            fields[key] = { stringValue: val };
        } else if (typeof val === 'number') {
            if (Number.isInteger(val)) {
                fields[key] = { integerValue: String(val) };
            } else {
                fields[key] = { doubleValue: val };
            }
        } else if (typeof val === 'boolean') {
            fields[key] = { booleanValue: val };
        } else if (Array.isArray(val)) {
            fields[key] = {
                arrayValue: {
                    values: val.map(item => {
                        if (typeof item === 'string') return { stringValue: item };
                        if (typeof item === 'number') return Number.isInteger(item) ? { integerValue: String(item) } : { doubleValue: item };
                        if (typeof item === 'boolean') return { booleanValue: item };
                        return { stringValue: String(item) };
                    })
                }
            };
        }
    }
    return fields;
}

async function signIn(email, password) {
    console.log(`Authenticating with Firebase Auth as ${email}...`);
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error?.message || 'Authentication failed');
    }
    if (data.localId !== ownerUid) {
        console.warn(`Warning: Signed in UID (${data.localId}) does not match OWNER_UID (${ownerUid})`);
    }
    return data.idToken;
}

async function uploadAllBooks(idToken) {
    console.log(`\nUploading ${booksData.length} books to Firestore for user ${ownerUid}...`);
    let uploadedCount = 0;
    let sessionCount = 0;

    for (let i = 0; i < booksData.length; i++) {
        const b = booksData[i];
        const docId = encodeURIComponent(String(b.coverId || b.id || b.title.replace(/\s+/g, '-').toLowerCase()));
        
        // 1. Upload public book document
        const publicDoc = {
            id: String(b.coverId || b.id || b.title.replace(/\s+/g, '-').toLowerCase()),
            olKey: b.olKey || '',
            title: b.title,
            author: b.author,
            authors: Array.isArray(b.authors) ? b.authors : [b.author],
            coverId: b.coverId || null,
            cover: b.cover || '',
            pages: b.pages || 350,
            currentPage: b.currentPage || 0,
            progress: b.progress || 0,
            status: b.status || 'want-to-read',
            rating: b.rating || null,
            favorite: Boolean(b.favorite),
            genres: Array.isArray(b.genres) ? b.genres : [],
            startedOn: b.startedOn || '',
            finishedOn: b.finishedOn || ''
        };

        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${ownerUid}/books/${docId}`;
        const patchRes = await fetch(firestoreUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: toFirestoreFields(publicDoc) })
        });

        if (!patchRes.ok) {
            const errText = await patchRes.text();
            console.error(`Failed to upload ${b.title}:`, errText);
            continue;
        }

        // 2. Upload private notes if present
        if (b.privateNotes) {
            const privateUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${ownerUid}/books/${docId}/private/notes`;
            await fetch(privateUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: { notes: { stringValue: b.privateNotes } } })
            });
        }

        // 3. Upload reading sessions if present
        if (Array.isArray(b.logs)) {
            for (let j = 0; j < b.logs.length; j++) {
                const log = b.logs[j];
                if (!log.minutes) continue;
                const sid = `bookmory_${docId}_${j + 1}`;
                const sessionDoc = {
                    id: sid,
                    startedAt: log.start ? `${log.start}T12:00:00.000Z` : new Date().toISOString(),
                    minutes: log.minutes,
                    fromPage: 0,
                    toPage: b.status === 'completed' ? b.pages : 0,
                    pagesRead: b.status === 'completed' ? b.pages : 0
                };
                const sessUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${ownerUid}/books/${docId}/sessions/${sid}`;
                await fetch(sessUrl, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ fields: toFirestoreFields(sessionDoc) })
                });
                sessionCount++;
            }
        }

        uploadedCount++;
        process.stdout.write(`\rUploaded ${uploadedCount}/${booksData.length} books...`);
    }

    console.log(`\n\nSuccess! Uploaded ${uploadedCount} books and ${sessionCount} reading sessions to Firestore!`);
}

async function main() {
    const args = process.argv.slice(2);
    let email = 'admin@gmail.com';
    let password = args[0] || '';

    if (!password) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const question = (q) => new Promise(res => rl.question(q, res));
        const emailInput = await question(`Enter owner email [${email}]: `);
        if (emailInput.trim()) email = emailInput.trim();
        password = await question('Enter owner password: ');
        rl.close();
    }

    if (!password) {
        console.error('Password is required to authenticate with Firebase.');
        process.exit(1);
    }

    try {
        const idToken = await signIn(email, password);
        await uploadAllBooks(idToken);
    } catch (err) {
        console.error('Upload failed:', err.message);
        process.exit(1);
    }
}

main();
