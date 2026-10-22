import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSteamXmlProfile } from '../scripts/sync-steam.mjs';
import {
    normalizeTitle,
    findSteamGameHours,
    getSteamOnlineStatusConfig,
    DEFAULT_STEAM_ID,
    DEFAULT_PROFILE_URL,
} from '../src/lib/steam.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('Steam Integration: parseSteamXmlProfile extracts user and game data correctly', () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><profile>
    <steamID64>76561198417375364</steamID64>
    <steamID><![CDATA[Liz Buxbaum]]></steamID>
    <onlineState>online</onlineState>
    <stateMessage><![CDATA[Online]]></stateMessage>
    <privacyState>public</privacyState>
    <avatarFull><![CDATA[https://avatars.fastly.steamstatic.com/sample_full.jpg]]></avatarFull>
    <memberSince>September 1, 2017</memberSince>
    <hoursPlayed2Wk>0.8</hoursPlayed2Wk>
    <realname><![CDATA[SimpingKato]]></realname>
    <summary><![CDATA[ok I pull up<img src="https://community.fastly.steamstatic.com/economy/emoticon/steamfacepalm" alt=":steamfacepalm:">]]></summary>
    <mostPlayedGames>
        <mostPlayedGame>
            <gameName><![CDATA[Warhammer: Vermintide 2]]></gameName>
            <gameLink><![CDATA[https://steamcommunity.com/app/552500]]></gameLink>
            <gameIcon><![CDATA[https://shared.fastly.steamstatic.com/apps/552500/icon.jpg]]></gameIcon>
            <gameLogo><![CDATA[https://shared.fastly.steamstatic.com/apps/552500/capsule.jpg]]></gameLogo>
            <hoursPlayed>0.8</hoursPlayed>
            <hoursOnRecord>16.8</hoursOnRecord>
            <statsName><![CDATA[552500]]></statsName>
        </mostPlayedGame>
    </mostPlayedGames>
</profile>`;

    const parsed = parseSteamXmlProfile(sampleXml);
    assert.equal(parsed.steamId64, '76561198417375364');
    assert.equal(parsed.personaName, 'Liz Buxbaum');
    assert.equal(parsed.realName, 'SimpingKato');
    assert.equal(parsed.onlineState, 'online');
    assert.equal(parsed.stateMessage, 'Online');
    assert.equal(parsed.avatarUrl, 'https://avatars.fastly.steamstatic.com/sample_full.jpg');
    assert.equal(parsed.memberSince, 'September 1, 2017');
    assert.equal(parsed.summary, 'ok I pull up');
    assert.equal(parsed.recentGames.length, 1);
    assert.equal(parsed.recentGames[0].name, 'Warhammer: Vermintide 2');
    assert.equal(parsed.recentGames[0].appId, '552500');
    assert.equal(parsed.recentGames[0].playtimeForeverHours, 16.8);
    assert.equal(parsed.recentGames[0].playtime2WkHours, 0.8);
    assert.equal(parsed.totalHours, 16.8);
});

test('Steam Integration: normalizeTitle cleans punctuation and whitespace', () => {
    assert.equal(normalizeTitle('Warhammer: Vermintide 2'), 'warhammer vermintide 2');
    assert.equal(normalizeTitle('Counter-Strike: Global Offensive™'), 'counter strike global offensive');
    assert.equal(normalizeTitle("Baldur's Gate 3"), 'baldur s gate 3');
    assert.equal(normalizeTitle('   Elden   Ring   '), 'elden ring');
    assert.equal(normalizeTitle(''), '');
    assert.equal(normalizeTitle(null), '');
});

test('Steam Integration: findSteamGameHours matches exact and partial titles', () => {
    const mockData = {
        recentGames: [
            { appId: '552500', name: 'Warhammer: Vermintide 2', playtimeForeverHours: 16.8 },
            { appId: '1091500', name: 'Cyberpunk 2077', playtimeForeverHours: 110.5 },
        ],
    };

    // Exact match
    const exact = findSteamGameHours('Warhammer: Vermintide 2', mockData);
    assert.ok(exact);
    assert.equal(exact.hours, 16.8);
    assert.equal(exact.appId, '552500');

    // Case-insensitive match
    const caseMatch = findSteamGameHours('cyberpunk 2077', mockData);
    assert.ok(caseMatch);
    assert.equal(caseMatch.hours, 110.5);

    // Substring / partial match
    const partial = findSteamGameHours('Vermintide 2', mockData);
    assert.ok(partial);
    assert.equal(partial.hours, 16.8);

    // Non-match
    const nonMatch = findSteamGameHours('Super Mario Odyssey', mockData);
    assert.equal(nonMatch, null);

    // Null safety
    assert.equal(findSteamGameHours('', mockData), null);
    assert.equal(findSteamGameHours('Elden Ring', null), null);
});

test('Steam Integration: getSteamOnlineStatusConfig maps statuses correctly', () => {
    const online = getSteamOnlineStatusConfig('online');
    assert.equal(online.label, 'Online');
    assert.ok(online.badgeClass.includes('blue'));

    const inGame = getSteamOnlineStatusConfig('in-game');
    assert.equal(inGame.label, 'In-Game');
    assert.ok(inGame.badgeClass.includes('emerald'));

    const offline = getSteamOnlineStatusConfig('offline');
    assert.equal(offline.label, 'Offline');
    assert.ok(offline.badgeClass.includes('gray'));
});

test('Steam Integration: public/data/steam-stats.json exists and is valid', () => {
    const filePath = path.join(ROOT_DIR, 'public', 'data', 'steam-stats.json');
    assert.ok(fs.existsSync(filePath), 'public/data/steam-stats.json must exist');

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(content.steamId64, DEFAULT_STEAM_ID);
    assert.equal(content.profileUrl, DEFAULT_PROFILE_URL);
    assert.ok(content.personaName, 'Must have a persona name');
    assert.ok(Array.isArray(content.recentGames), 'Must have recentGames array');
});
