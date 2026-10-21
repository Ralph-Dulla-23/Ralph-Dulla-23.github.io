import { saveCalendarPng } from '../services/calendarDownload.js';
import { Capacitor, registerPlugin } from '@capacitor/core';
const PrivateCoverCache = registerPlugin('DiaryMediaStore');

const SIZE = { '1:1': [1080, 1080], '4:5': [1080, 1350], '9:16': [1080, 1920] };
const THEMES = {
  'midnight': { top: '#091727', bottom: '#213b5c', ink: '#f8fafc', muted: '#bed4df', accent: '#7adad3', tile: '#20344b' },
  'sunset': { top: '#502e47', bottom: '#df9072', ink: '#fff9f0', muted: '#ffdbc9', accent: '#ffcd7c', tile: '#66415a' },
  'editorial': { top: '#ece3d5', bottom: '#faf5ed', ink: '#2b3039', muted: '#626b76', accent: '#386d86', tile: '#ffffff' },
  'lilac': { top: '#292445', bottom: '#786ba3', ink: '#ffffff', muted: '#e3d8f3', accent: '#e8b4ff', tile: '#4a416e' },
};

const zeroPad = (n) => String(n).padStart(2, '0');
const parseTheme = (name) => {
  if (THEMES[name]) return THEMES[name];
  if (name === '#14223d') return THEMES.midnight;
  if (name === '#f7efe6') return THEMES.editorial;
  if (name === '#d9ebf6') return { ...THEMES.editorial, top: '#daeefa', bottom: '#f6faff' };
  return THEMES.midnight;
};
const roundedRect = (ctx, x, y, width, height, radius, fill) => {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fillStyle = fill; ctx.fill();
};
const imageWithin = (ctx, img, x, y, width, height, radius = 8) => {
  if (!img) return;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.clip();
  const fit = Math.max(width / img.width, height / img.height);
  const w = img.width * fit, h = img.height * fit;
  ctx.drawImage(img, x + (width - w) / 2, y + (height - h) / 2, w, h);
  ctx.restore();
};
const fetchCover = async (src) => {
  if (!src || typeof src !== 'string' || !/^https:\/\//i.test(src) && !src.startsWith('data:image/')) return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.src = src;
    await Promise.race([img.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('Cover timeout')), 2800))]);
    return img;
  } catch {
    // A native allowlisted cache can read certain cross-origin cover hosts that
    // Android WebView canvas cannot. Images are stored only on this device.
    if (Capacitor.getPlatform() !== 'android' || !Capacitor.isNativePlatform()) return null;
    try {
      const result = await PrivateCoverCache.getCover({ url: src });
      if (!result.dataUrl) return null;
      const fallback = new Image(); fallback.src = result.dataUrl;
      await fallback.decode(); return fallback;
    } catch { return null; }
  }
};
const loadPhoto = async (dataUrl) => {
  if (!dataUrl?.startsWith('data:image/')) return null;
  const img = new Image(); img.src = dataUrl;
  await img.decode(); return img;
};

/** Pure image renderer. Does not access Firestore, store a private note or capture app chrome. */
export async function renderCalendarPng({year, month, sessionsByDate, ratio = '4:5', background = 'midnight', photoDataUrl = null}) {
  if (!Number.isInteger(year) || month < 0 || month > 11) throw new Error('Invalid calendar date');
  if (!(sessionsByDate instanceof Map)) throw new Error('Calendar activities must be a date-indexed Map');
  const [width, height] = SIZE[ratio] || SIZE['4:5'];
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas rendering is unavailable');
  const style = parseTheme(background);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, style.top); gradient.addColorStop(1, style.bottom);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  let photo = null;
  if (photoDataUrl) {
    try { photo = await loadPhoto(photoDataUrl); imageWithin(ctx, photo, 0, 0, width, height, 0); }
    catch { throw new Error('Your background photo could not be decoded. Please select another image.'); }
    ctx.fillStyle = 'rgba(5,12,28,0.68)'; ctx.fillRect(0, 0, width, height);
  }
  const ink = photo ? '#fff' : style.ink;
  const muted = photo ? '#e4ecf6' : style.muted;
  const accent = photo ? '#a8e7e6' : style.accent;
  const light = style === THEMES.editorial && !photo || background === '#f7efe6' && !photo;
  const pad = 68, right = width - pad;
  const heroSize = ratio === '9:16' ? 78 : 72;
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  ctx.textAlign = 'left';
  ctx.font = '700 25px system-ui, sans-serif'; ctx.fillStyle = accent;
  ctx.fillText('MY DIARY   /   THE MONTH IN STORIES', pad, 104);
  ctx.fillStyle = ink; ctx.font = `800 ${heroSize}px system-ui, sans-serif`;
  ctx.fillText(monthLabel, pad, 194);
  ctx.font = '400 27px system-ui, sans-serif'; ctx.fillStyle = muted;
  ctx.fillText('A little reading. A little gaming. A lot of memories.', pad, 242);
  const keys = [], count = new Date(year, month + 1, 0).getDate();
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  let activeDays = 0, sessionsCount = 0;
  const images = new Map(), uniqueUrls = new Set();
  for (let day=1; day<=count; day++) {
    const key = `${year}-${zeroPad(month + 1)}-${zeroPad(day)}`;
    const sessions = sessionsByDate.get(key) || [];
    keys.push({ day, sessions });
    if (sessions.length) { activeDays++; sessionsCount += sessions.length; }
    for (const session of sessions) { if (session.itemCover) uniqueUrls.add(session.itemCover); }
  }
  // Bound concurrent remote decoding on memory-constrained Android phones.
  const urls = [...uniqueUrls].slice(0, 80);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      images.set(url, await fetchCover(url));
    }
  }));
  // Featured cover collage: a recognizably personal editorial accent rather
  // than a spreadsheet-style month with no visual focal point.
  const featured = urls.filter(src => images.get(src)).slice(0, 3);
  featured.forEach((src,i) => {
    const img = images.get(src);
    const cx = 750 + i * 74;
    const cy = 100 + (i % 2) * 18;
    ctx.save();
    ctx.translate(cx + 51, cy + 66);
    ctx.rotate((-8 + i * 7) * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,.25)';ctx.shadowBlur = 20;ctx.shadowOffsetY = 9;
    roundedRect(ctx,-48,-63,96,132,12,'#fff');
    ctx.shadowBlur = 0;ctx.shadowOffsetY = 0;
    imageWithin(ctx,img,-44,-59,88,124,9);
    ctx.restore();
  });
  // Reserves the bottom strip for activity stats and eliminates the previous blank half-page.
  const top = ratio === '9:16' ? 440 : 340;
  const bottom = height - (ratio === '9:16' ? 300 : 175);
  const gridWidth = width - pad * 2;
  const weekRows = Math.ceil((first + count) / 7);
  const gap = ratio === '1:1' ? 5 : 8;
  const cellW = (gridWidth - 6 * gap) / 7;
  const gridH = bottom - top;
  const headerH = 42;
  const cellH = Math.floor((gridH - headerH - (weekRows - 1) * gap) / weekRows);
  roundedRect(ctx, pad - 18, top - 25, gridWidth + 36, gridH + 45, 28, photo ? 'rgba(9,16,32,0.72)' : (light ? 'rgba(255,255,255,.68)' : 'rgba(9,19,35,.35)'));
  const weekdays = ['M','T','W','T','F','S','S'];
  ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.font = '700 22px system-ui, sans-serif';
  weekdays.forEach((d,i) => ctx.fillText(d, pad + (i + .5) * (cellW + gap) - gap / 2, top + 11));
  keys.forEach(({day,sessions}) => {
    const slot = first + day - 1, col = slot % 7, row = Math.floor(slot / 7);
    const x = pad + col * (cellW + gap), y = top + headerH + row * (cellH + gap);
    roundedRect(ctx, x, y, cellW, cellH, 12, photo ? 'rgba(255,255,255,.14)' : style.tile);
    if (sessions.length) roundedRect(ctx, x, y, cellW, 5, 3, accent);
    ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(String(day), x + 11, y + 30);
    const seen = new Set();
    const covers = sessions.filter(s => {
      const k = String(s.itemId || s.itemTitle || s.itemCover);
      if (!s.itemCover || seen.has(k)) return false;
      seen.add(k); return true;
    }).slice(0,2);
    const coverY = y + 40, coverH = Math.max(25, cellH - 52);
    const coverW = covers.length > 1 ? Math.floor((cellW - 25) / 2) : Math.min(58, cellW - 18);
    covers.forEach((entry, i) => {
      const cx = x + 9 + i * (coverW + 5);
      const ch = Math.min(coverH, coverW * 1.53);
      const img = images.get(entry.itemCover);
      if (img) imageWithin(ctx, img, cx, coverY, coverW, ch, 6);
      else { roundedRect(ctx,cx,coverY,coverW,ch,5,photo?'rgba(255,255,255,.16)':(light?'#e4e7ee':'#52617f')); }
    });
    if (sessions.length > 1) { ctx.fillStyle = accent; ctx.font = '700 17px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`${sessions.length}×`, x + cellW - 7, y + cellH - 8); }
  });
  const footerY = Math.max(bottom + 50, height - (ratio === '9:16' ? 230 : 117));
  ctx.textAlign = 'left'; ctx.font = '800 51px system-ui, sans-serif'; ctx.fillStyle = ink;
  ctx.fillText(String(activeDays).padStart(2, '0'), pad, footerY);
  ctx.fillText(String(sessionsCount).padStart(2, '0'), pad + 235, footerY);
  ctx.font = '500 20px system-ui, sans-serif'; ctx.fillStyle = muted;
  ctx.fillText('ACTIVE DAYS', pad, footerY + 32);
  ctx.fillText('RECORDED SESSIONS', pad + 235, footerY + 32);
  ctx.textAlign = 'right'; ctx.font = '700 22px system-ui, sans-serif'; ctx.fillStyle = accent;
  ctx.fillText('READ • PLAY • REMEMBER', right, height - 44);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to encode PNG')), 'image/png'));
}

export async function exportCalendarPng(options) {
  const blob = await renderCalendarPng(options);
  return saveCalendarPng(blob, `my-diary-${options.year}-${zeroPad(options.month + 1)}.png`, options.destination);
}
