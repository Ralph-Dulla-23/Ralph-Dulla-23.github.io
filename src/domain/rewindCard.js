/** Self-contained, opt-in Year in Books & Games card. No external images, notes or identifiers. */
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const number = (v) => Number.isFinite(Number(v)) ? Math.round(Math.max(0,Number(v))) : 0;
export function buildRewindSvg(rewind) {
  const y = String(rewind?.year || new Date().getFullYear());
  if (!/^\d{4}$/.test(y)) throw new Error('Invalid rewind year.');
  const books = number(rewind?.booksCompleted), games = number(rewind?.gamesCompleted);
  const pages = number(rewind?.pages), reading = number(rewind?.bookMinutes), gaming = number(rewind?.gameMinutes);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b1327"/><stop offset="1" stop-color="#1b2445"/></linearGradient><linearGradient id="ac" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6ed7db"/><stop offset="1" stop-color="#9b94ff"/></linearGradient></defs>
<rect width="1080" height="1350" fill="url(#bg)"/><circle cx="1015" cy="80" r="330" fill="#4c6bba" opacity=".12"/><circle cx="-90" cy="1190" r="340" fill="#38b9ad" opacity=".09"/>
<g font-family="Arial, sans-serif" fill="#e9f4ff"><text x="84" y="144" font-size="29" letter-spacing="8" fill="#96b0d2">YOUR YEAR IN STORIES</text><text x="80" y="294" font-size="136" font-weight="bold">${esc(y)}</text><path d="M80 335 H1000" stroke="#3c4f77" stroke-width="2"/>
<text x="90" y="460" font-size="31" fill="#96b0d2">BOOKS COMPLETED</text><text x="90" y="584" font-size="116" font-weight="bold" fill="#7ad8dd">${books}</text>
<text x="580" y="460" font-size="31" fill="#96b0d2">GAMES COMPLETED</text><text x="580" y="584" font-size="116" font-weight="bold" fill="#a5a0ff">${games}</text>
<rect x="80" y="660" width="920" height="258" rx="34" fill="#263451"/><text x="125" y="748" font-size="32" fill="#a9bfdb">TOTAL TRACKED TIME</text><text x="120" y="866" font-size="98" font-weight="bold">${Math.round((reading+gaming)/60)}<tspan font-size="43"> hours</tspan></text>
<text x="90" y="1022" font-size="33" fill="#a6bdcc">Reading time</text><text x="990" y="1022" font-size="38" font-weight="bold" text-anchor="end">${Math.round(reading)} min</text>
<text x="90" y="1106" font-size="33" fill="#a6bdcc">Gaming time</text><text x="990" y="1106" font-size="38" font-weight="bold" text-anchor="end">${Math.round(gaming)} min</text>
<text x="90" y="1192" font-size="33" fill="#a6bdcc">Pages in timed sessions</text><text x="990" y="1192" font-size="38" font-weight="bold" text-anchor="end">${pages}</text>
<text x="90" y="1295" font-size="24" fill="#7e9bbd">Recorded activity only · Undated imports not estimated</text></g></svg>`;
}

export async function downloadRewindCard(rewind) {
  const svg = buildRewindSvg(rewind);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = svgUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1350;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable on this device.');
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Unable to export rewind image.');
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    try {
      link.href = url; link.download = `diary-rewind-${rewind.year}.png`;
      document.body.appendChild(link); link.click(); link.remove();
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1500); }
  } finally { URL.revokeObjectURL(svgUrl); }
}
