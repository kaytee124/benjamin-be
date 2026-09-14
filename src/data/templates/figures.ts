/** Trusted parametric SVG builders for GED-style figure questions. */

const INK = "#1a2330";
const MUTED = "#5c6b7a";
const ACCENT = "#2f6fed";

function svgWrap(
  title: string,
  body: string,
  width = 360,
  height = 280
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title>${body}</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Map math coords to SVG: origin near bottom-left of plot area. */
function mapPt(
  x: number,
  y: number,
  ox: number,
  oy: number,
  scale: number
): { x: number; y: number } {
  return { x: ox + x * scale, y: oy - y * scale };
}

/** Coordinate plane with a line y = mx + b through x-range. */
export function coordPlaneLineSvg(opts: {
  m: number;
  b: number;
  xMin?: number;
  xMax?: number;
  title?: string;
}): string {
  const xMin = opts.xMin ?? -1;
  const xMax = opts.xMax ?? 6;
  const ox = 50;
  const oy = 220;
  const scale = 28;
  const yMin = -2;
  const yMax = 10;

  const ticks: string[] = [];
  for (let x = 0; x <= 6; x += 1) {
    const p = mapPt(x, 0, ox, oy, scale);
    ticks.push(
      `<line x1="${p.x}" y1="${oy - 4}" x2="${p.x}" y2="${oy + 4}" stroke="${MUTED}" stroke-width="1"/><text x="${p.x}" y="${oy + 16}" text-anchor="middle" font-size="10" fill="${MUTED}">${x}</text>`
    );
  }
  for (let y = 0; y <= 8; y += 2) {
    const p = mapPt(0, y, ox, oy, scale);
    ticks.push(
      `<line x1="${ox - 4}" y1="${p.y}" x2="${ox + 4}" y2="${p.y}" stroke="${MUTED}" stroke-width="1"/><text x="${ox - 10}" y="${p.y + 3}" text-anchor="end" font-size="10" fill="${MUTED}">${y}</text>`
    );
  }

  const y1 = opts.m * xMin + opts.b;
  const y2 = opts.m * xMax + opts.b;
  const p1 = mapPt(xMin, y1, ox, oy, scale);
  const p2 = mapPt(xMax, y2, ox, oy, scale);

  // Clip-ish by just drawing the segment
  const body = `
    <rect x="8" y="8" width="344" height="264" fill="#fafbfc" stroke="#d8dee6" rx="4"/>
    <line x1="${ox}" y1="${mapPt(0, yMax, ox, oy, scale).y}" x2="${ox}" y2="${mapPt(0, yMin, ox, oy, scale).y}" stroke="${INK}" stroke-width="1.5"/>
    <line x1="${mapPt(xMin, 0, ox, oy, scale).x}" y1="${oy}" x2="${mapPt(xMax, 0, ox, oy, scale).x}" y2="${oy}" stroke="${INK}" stroke-width="1.5"/>
    <text x="330" y="${oy - 8}" font-size="12" fill="${INK}">x</text>
    <text x="${ox + 8}" y="28" font-size="12" fill="${INK}">y</text>
    ${ticks.join("")}
    <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${ACCENT}" stroke-width="2.5"/>
  `;
  return svgWrap(opts.title ?? "Linear graph on a coordinate plane", body);
}

/** Right triangle with legs a (horizontal) and b (vertical), hypotenuse unlabeled. */
export function rightTriangleSvg(opts: {
  a: number;
  b: number;
  title?: string;
}): string {
  const maxLeg = Math.max(opts.a, opts.b);
  const scale = 160 / maxLeg;
  const ox = 40;
  const oy = 240;
  const ax = ox + opts.a * scale;
  const by = oy - opts.b * scale;
  const body = `
    <rect x="8" y="8" width="344" height="264" fill="#fafbfc" stroke="#d8dee6" rx="4"/>
    <polygon points="${ox},${oy} ${ax},${oy} ${ox},${by}" fill="none" stroke="${INK}" stroke-width="2.5"/>
    <polyline points="${ox},${oy - 14} ${ox + 14},${oy - 14} ${ox + 14},${oy}" fill="none" stroke="${INK}" stroke-width="1.5"/>
    <text x="${(ox + ax) / 2}" y="${oy + 18}" text-anchor="middle" font-size="14" fill="${INK}">${opts.a}</text>
    <text x="${ox - 14}" y="${(oy + by) / 2}" text-anchor="middle" font-size="14" fill="${INK}">${opts.b}</text>
    <text x="${(ox + ax) / 2 + 10}" y="${(oy + by) / 2 - 6}" font-size="13" fill="${ACCENT}">?</text>
  `;
  return svgWrap(opts.title ?? "Right triangle", body);
}

/** Two parallel lines cut by a transversal; label angle at intersection. */
export function transversalSvg(opts: {
  markedAngle: number;
  title?: string;
}): string {
  const body = `
    <rect x="8" y="8" width="344" height="264" fill="#fafbfc" stroke="#d8dee6" rx="4"/>
    <line x1="40" y1="90" x2="320" y2="90" stroke="${INK}" stroke-width="2.5"/>
    <line x1="40" y1="190" x2="320" y2="190" stroke="${INK}" stroke-width="2.5"/>
    <line x1="100" y1="40" x2="260" y2="240" stroke="${ACCENT}" stroke-width="2.5"/>
    <text x="48" y="82" font-size="12" fill="${MUTED}">ℓ₁</text>
    <text x="48" y="182" font-size="12" fill="${MUTED}">ℓ₂</text>
    <text x="168" y="78" font-size="14" fill="${ACCENT}">${opts.markedAngle}°</text>
    <text x="210" y="168" font-size="14" fill="${INK}">?</text>
  `;
  return svgWrap(
    opts.title ?? "Parallel lines cut by a transversal",
    body
  );
}

/** Two similar triangles with side labels. */
export function similarTrianglesSvg(opts: {
  a: number;
  b: number;
  a2: number;
  title?: string;
}): string {
  const body = `
    <rect x="8" y="8" width="344" height="264" fill="#fafbfc" stroke="#d8dee6" rx="4"/>
    <polygon points="40,220 140,220 40,100" fill="none" stroke="${INK}" stroke-width="2"/>
    <polygon points="200,230 330,230 200,80" fill="none" stroke="${ACCENT}" stroke-width="2"/>
    <text x="90" y="238" text-anchor="middle" font-size="13" fill="${INK}">${opts.a}</text>
    <text x="28" y="160" font-size="13" fill="${INK}">${opts.b}</text>
    <text x="265" y="248" text-anchor="middle" font-size="13" fill="${ACCENT}">${opts.a2}</text>
    <text x="188" y="155" font-size="13" fill="${ACCENT}">?</text>
    <text x="70" y="40" font-size="12" fill="${MUTED}">△ABC ~ △DEF</text>
  `;
  return svgWrap(opts.title ?? "Similar triangles", body);
}

/** Simple box plot on a number line. */
export function boxPlotSvg(opts: {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  title?: string;
}): string {
  const lo = opts.min - 1;
  const hi = opts.max + 1;
  const span = hi - lo || 1;
  const xOf = (v: number) => 40 + ((v - lo) / span) * 280;
  const y = 140;
  const body = `
    <rect x="8" y="8" width="344" height="264" fill="#fafbfc" stroke="#d8dee6" rx="4"/>
    <line x1="40" y1="200" x2="320" y2="200" stroke="${INK}" stroke-width="1.5"/>
    <line x1="${xOf(opts.min)}" y1="${y}" x2="${xOf(opts.max)}" y2="${y}" stroke="${INK}" stroke-width="2"/>
    <line x1="${xOf(opts.min)}" y1="${y - 18}" x2="${xOf(opts.min)}" y2="${y + 18}" stroke="${INK}" stroke-width="2"/>
    <line x1="${xOf(opts.max)}" y1="${y - 18}" x2="${xOf(opts.max)}" y2="${y + 18}" stroke="${INK}" stroke-width="2"/>
    <rect x="${xOf(opts.q1)}" y="${y - 28}" width="${xOf(opts.q3) - xOf(opts.q1)}" height="56" fill="#d6e4ff" stroke="${ACCENT}" stroke-width="2"/>
    <line x1="${xOf(opts.median)}" y1="${y - 28}" x2="${xOf(opts.median)}" y2="${y + 28}" stroke="${ACCENT}" stroke-width="2.5"/>
    <text x="${xOf(opts.min)}" y="220" text-anchor="middle" font-size="11" fill="${MUTED}">${opts.min}</text>
    <text x="${xOf(opts.q1)}" y="220" text-anchor="middle" font-size="11" fill="${MUTED}">${opts.q1}</text>
    <text x="${xOf(opts.median)}" y="236" text-anchor="middle" font-size="11" fill="${INK}">${opts.median}</text>
    <text x="${xOf(opts.q3)}" y="220" text-anchor="middle" font-size="11" fill="${MUTED}">${opts.q3}</text>
    <text x="${xOf(opts.max)}" y="220" text-anchor="middle" font-size="11" fill="${MUTED}">${opts.max}</text>
  `;
  return svgWrap(opts.title ?? "Box plot", body);
}

/** Scatter plot with roughly linear upward or downward trend. */
export function scatterSvg(opts: {
  points: { x: number; y: number }[];
  title?: string;
}): string {
  const ox = 50;
  const oy = 220;
  const scale = 26;
  const dots = opts.points
    .map((pt) => {
      const p = mapPt(pt.x, pt.y, ox, oy, scale);
      return `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${ACCENT}"/>`;
    })
    .join("");
  const body = `
    <rect x="8" y="8" width="344" height="264" fill="#fafbfc" stroke="#d8dee6" rx="4"/>
    <line x1="${ox}" y1="40" x2="${ox}" y2="${oy}" stroke="${INK}" stroke-width="1.5"/>
    <line x1="${ox}" y1="${oy}" x2="320" y2="${oy}" stroke="${INK}" stroke-width="1.5"/>
    <text x="330" y="${oy - 8}" font-size="12" fill="${INK}">x</text>
    <text x="${ox + 8}" y="32" font-size="12" fill="${INK}">y</text>
    ${dots}
  `;
  return svgWrap(opts.title ?? "Scatter plot", body);
}

/** Spinner divided into equal slices with labels. */
export function spinnerSvg(opts: {
  slices: { label: string; color: string }[];
  title?: string;
}): string {
  const cx = 180;
  const cy = 140;
  const r = 90;
  const n = opts.slices.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    parts.push(
      `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z" fill="${opts.slices[i].color}" stroke="${INK}" stroke-width="1.5"/>`
    );
    const mid = (a0 + a1) / 2;
    const lx = cx + r * 0.55 * Math.cos(mid);
    const ly = cy + r * 0.55 * Math.sin(mid);
    parts.push(
      `<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="14" fill="${INK}">${escapeXml(opts.slices[i].label)}</text>`
    );
  }
  const body = `
    <rect x="8" y="8" width="344" height="264" fill="#fafbfc" stroke="#d8dee6" rx="4"/>
    ${parts.join("")}
  `;
  return svgWrap(opts.title ?? "Spinner", body);
}
