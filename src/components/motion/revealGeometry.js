/** Pure math for bottom-origin circular reveals. All coordinates are viewport CSS pixels. */
export function getCircularRevealGeometry(origin, width, height) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const x = Math.max(0, Math.min(w, Number.isFinite(origin?.x) ? origin.x : w / 2));
  const y = Math.max(0, Math.min(h, Number.isFinite(origin?.y) ? origin.y : h - 108));
  const radius = Math.ceil(Math.max(
    Math.hypot(x, y), Math.hypot(w - x, y),
    Math.hypot(x, h - y), Math.hypot(w - x, h - y),
  )) + 2;
  const center = `${Math.round(x)}px ${Math.round(y)}px`;
  return { x, y, radius, closed: `circle(0px at ${center})`, open: `circle(${radius}px at ${center})` };
}
