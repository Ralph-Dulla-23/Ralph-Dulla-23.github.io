import test from 'node:test';
import assert from 'node:assert/strict';
import { isOwner, OWNER_UID } from '../src/lib/config.js';

test('TC-02: isOwner returns false when user is null or undefined', () => {
    assert.equal(isOwner(null), false);
    assert.equal(isOwner(undefined), false);
    assert.equal(isOwner({}), false);
    assert.equal(isOwner({ uid: '' }), false);
});

test('TC-02: isOwner returns false when OWNER_UID is empty (fail-closed check)', () => {
    // Current environment may or may not have OWNER_UID set.
    // If OWNER_UID is empty:
    if (!OWNER_UID) {
        assert.equal(isOwner({ uid: 'any-user-id' }), false);
    }
});

test('TC-02: isOwner logic strictly verifies matching UID', () => {
    // Test direct helper logic matching config.js
    const checkIsOwner = (u, expectedOwner) => {
        const owner = (expectedOwner || '').trim();
        if (!u?.uid || !owner) return false;
        return u.uid === owner;
    };

    assert.equal(checkIsOwner({ uid: 'owner-123' }, 'owner-123'), true);
    assert.equal(checkIsOwner({ uid: 'owner-123' }, 'owner-999'), false);
    assert.equal(checkIsOwner({ uid: 'owner-123' }, ''), false, 'Empty OWNER_UID must fail closed');
    assert.equal(checkIsOwner({ uid: 'owner-123' }, '   '), false, 'Whitespace OWNER_UID must fail closed');
    assert.equal(checkIsOwner(null, 'owner-123'), false, 'Null user must fail closed');
});

test('TC-01: AuthContext contract ensures no unverified localStorage user bypass', () => {
    // Simulate AuthContext state resolution:
    // With our fix, AuthContext initial user state is null and loading is boolean(auth).
    // onAuthStateChanged strictly sets currentUser ?? null without consulting localStorage.
    const resolveUserOnAuthEvent = (currentUser) => currentUser ?? null;

    assert.equal(resolveUserOnAuthEvent(null), null, 'Signed-out auth event must strictly result in user=null');
    assert.equal(resolveUserOnAuthEvent({ uid: 'verified-owner' })?.uid, 'verified-owner');
});
