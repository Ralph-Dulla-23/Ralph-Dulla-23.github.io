import fs from 'node:fs';
import path from 'node:path';

const booksFile = path.resolve(process.cwd(), 'src/data/books.js');
if (!fs.existsSync(booksFile)) {
    console.error('FAIL verify-private-source: src/data/books.js not found');
    process.exitCode = 1;
} else {
    const content = fs.readFileSync(booksFile, 'utf8');
    // Ensure no private personal review notes or secret keys are stored in public data
    const forbiddenPatterns = [
        /privateNotes\s*:/i,
        /privateReview\s*:/i,
        /serviceAccountKey/i,
    ];
    let violations = 0;
    for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
            console.error(`FAIL verify-private-source: Detected forbidden pattern: ${pattern}`);
            violations++;
        }
    }
    if (violations === 0) {
        console.log('PASS verify-private-source: Zero private notes or credentials detected in public data assets (SEC-01).');
    } else {
        process.exitCode = 1;
    }
}
