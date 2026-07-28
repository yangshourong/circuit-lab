import type { PlacedComponent } from './types';
import { PIN_OFFSET } from './store';

/** Local-space (component-centred) coordinate of a pin, accounting for rotation. */
export function pinLocal(comp: PlacedComponent, pinId: string): { x: number; y: number } {
  // Custom pin positions (multi-pin components like multiSwitch)
  if (comp.pinPositions?.[pinId]) {
    const p = comp.pinPositions[pinId]!;
    const rad = ((comp.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
  }
  // Standard 2-pin: a = left (-52), any other = right (+52)
  const off = pinId === 'a' ? -PIN_OFFSET : PIN_OFFSET;
  const rad = ((comp.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: off * cos, y: off * sin };
}

/** World coordinate of a component pin. */
export function pinWorld(comp: PlacedComponent, pinId: string): { x: number; y: number } {
  const l = pinLocal(comp, pinId);
  return { x: comp.x + l.x, y: comp.y + l.y };
}

/** 仪表类型判断 */
function isMeterType(type: string): boolean {
  return type === 'ammeter' || type === 'voltmeter' || type === 'galvanometer';
}

/** 灯泡类型判断 */
function isLampType(type: string): boolean {
  return type === 'lamp';
}

/** 开关类型判断 */
function isSwitchType(type: string): boolean {
  return type === 'switch';
}

/** 多向开关类型判断 */
function isMultiSwitchType(type: string): boolean {
  return type === 'multiSwitch';
}

/**
 * 灯泡/开关在物理模式下的底座接线柱本地坐标。
 *   pin 'a' (+) → 左侧红色接线柱 (-33, 16)
 *   pin 'b' (−) → 右侧红色接线柱 (33, 16)
 */
function lampTerminalLocal(_comp: PlacedComponent, pinId: string): { x: number; y: number } {
  return pinId === 'a' ? { x: -33, y: 16 } : { x: 33, y: 16 };
}

/**
 * 多向开关在物理模式下的底座接线柱本地坐标（俯视布局）。
 *   COM (pin 'a') → (-48, 23)   左下黑色接线柱
 *   1   (pin 'b') → (43, -17.5) 右上红色接线柱
 *   2   (pin 'c') → (43, -6.5)
 *   3   (pin 'd') → (43, 4.5)
 *   4   (pin 'e') → (43, 15.5)  右下红色接线柱
 */
function multiSwitchTerminalLocal(_comp: PlacedComponent, pinId: string): { x: number; y: number } {
  const map: Record<string, { x: number; y: number }> = {
    a: { x: -48, y: 23 },
    b: { x: 43, y: -17.5 },
    c: { x: 43, y: -6.5 },
    d: { x: 43, y: 4.5 },
    e: { x: 43, y: 15.5 },
  };
  return map[pinId] ?? { x: 0, y: 0 };
}

/**
 * 仪表在物理模式下的底部接线柱本地坐标。
 * 三种接线柱：
 *   − (pin 'b')  → 左侧 (−33, 44)
 *   低量程 (+)    → 中间 (−5, 44)
 *   高量程 (+)    → 右侧 (23, 44)
 * pin 'a' 的位置随当前量程选择：低量程→中间，高量程→右侧。
 */
function meterTerminalLocal(comp: PlacedComponent, pinId: string): { x: number; y: number } {
  if (pinId === 'b') return { x: -33, y: 44 };

  // pin 'a' (+)：根据当前量程选择中间或右侧接线柱
  const range = String(comp.params?.range ?? '');
  // 低量程值：ammeter→0.6A, voltmeter→3V, galvanometer→0.5A
  const isLowRange = range === '0.6A' || range === '3V' || range === '0.5A';
  return { x: isLowRange ? -5 : 23, y: 44 };
}

/**
 * 仪表在物理模式下的底部接线柱世界坐标。
 * 考虑组件旋转变换。非仪表返回 null。
 */
/**
 * 组件在物理模式下的接线柱世界坐标（仪表 + 灯泡 + 开关 + 多向开关）。
 * 非上述类型返回 null。
 */
export function meterPhysicalEndpoint(
  comp: PlacedComponent,
  pinId: string,
): { x: number; y: number } | null {
  let local: { x: number; y: number } | null = null;
  if (isMeterType(comp.type)) {
    local = meterTerminalLocal(comp, pinId);
  } else if (isLampType(comp.type) || isSwitchType(comp.type)) {
    local = lampTerminalLocal(comp, pinId);
  } else if (isMultiSwitchType(comp.type)) {
    local = multiSwitchTerminalLocal(comp, pinId);
  }
  if (!local) return null;
  const rad = ((comp.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: comp.x + local.x * cos - local.y * sin,
    y: comp.y + local.x * sin + local.y * cos,
  };
}

/**
 * Physical-mode wire path — simulates a real hook-up lead draped between
 * two terminal posts.
 *
 * v2: Instead of a simple downward-sagging Bezier (which cuts through
 * components), the wire now:
 *   1. Exits each terminal at an outward angle (perpendicular offset)
 *   2. Curves gracefully toward the destination with catenary-like sag
 *   3. Sag direction alternates or picks the side with fewer obstacles
 *
 * This produces the natural "looping" look of real lab wires that are
 * plugged into terminals and drape loosely between equipment.
 */
export function physicalWirePath(
  a: { x: number; y: number },
  b: { x: number; y: number }
): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  // Very short wires → straight line (no room to drape)
  if (len < 30) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;

  // Unit vector along a→b, and perpendicular (rotated 90° CCW)
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular: (-uy, ux) points to the LEFT of the directed line a→b
  const px = -uy;
  const py = ux;

  // Sag amount scales with length but is capped for visual consistency
  const sag = Math.min(Math.max(len * 0.18, 12), 50);

  // Determine sag direction:
  //   For roughly horizontal wires (|dy| < |dx|): sag downward (+y)
  //   For roughly vertical wires: sag rightward (+x)
  //   This matches gravity + natural draping convention
  let sx: number, sy: number;
  if (Math.abs(dx) >= Math.abs(dy)) {
    // More horizontal than vertical → sag in y direction
    sx = 0;
    sy = Math.sign(dy) === 0 ? 1 : Math.sign(dy) * 0.6 + 0.4; // slight bias down
    if (Math.abs(sy) < 0.3) sy = 1;
  } else {
    // More vertical → sag in x direction
    sy = 0;
    sx = Math.sign(dx) === 0 ? 1 : Math.sign(dx) * 0.6 + 0.4;
    if (Math.abs(sx) < 0.3) sx = 1;
  }
  // Normalize sag direction
  const sLen = Math.hypot(sx, sy);
  sx /= sLen; sy /= sLen;

  // Outward kick at each terminal: wire exits terminal at an angle
  // before curving toward the other end. This creates the "plug" look.
  const kick = Math.min(len * 0.12, 16); // initial outward offset distance

  // Control points:
  //   P0 = a (start terminal)
  //   P1 = exit point from a, kicked outward + slightly toward b
  //   P2 = approach point to b, kicked outward + slightly from a
  //   P3 = b (end terminal)
  const p1x = a.x + ux * kick + sx * sag * 0.5;
  const p1y = a.y + uy * kick + sy * sag * 0.5;
  const p2x = b.x - ux * kick + sx * sag * 0.5;
  const p2y = b.y - uy * kick + sy * sag * 0.5;

  return `M ${a.x} ${a.y} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${b.x} ${b.y}`;
}

/**
 * Mid-point of a physical wire bezier path (for label placement).
 * Evaluates the cubic bezier at t = 0.5.
 */
export function physicalWireMidpoint(
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 30) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  const ux = dx / len, uy = dy / len;
  const sag = Math.min(Math.max(len * 0.18, 12), 50);
  let sx: number, sy: number;
  if (Math.abs(dx) >= Math.abs(dy)) {
    sx = 0;
    sy = dy === 0 ? 1 : Math.sign(dy) * 0.6 + 0.4;
    if (Math.abs(sy) < 0.3) sy = 1;
  } else {
    sy = 0;
    sx = dx === 0 ? 1 : Math.sign(dx) * 0.6 + 0.4;
    if (Math.abs(sx) < 0.3) sx = 1;
  }
  const sLen = Math.hypot(sx, sy);
  sx /= sLen; sy /= sLen;
  const kick = Math.min(len * 0.12, 16);
  const p1x = a.x + ux * kick + sx * sag * 0.5;
  const p1y = a.y + uy * kick + sy * sag * 0.5;
  const p2x = b.x - ux * kick + sx * sag * 0.5;
  const p2y = b.y - uy * kick + sy * sag * 0.5;
  // Cubic bezier at t = 0.5: mid = ⅛·P0 + ⅜·P1 + ⅜·P2 + ⅛·P3
  return {
    x: 0.125 * a.x + 0.375 * p1x + 0.375 * p2x + 0.125 * b.x,
    y: 0.125 * a.y + 0.375 * p1y + 0.375 * p2y + 0.125 * b.y,
  };
}

/**
 * Neat orthogonal (Manhattan) path for schematic mode — a single rounded
 * elbow so wires read as a tidy circuit diagram instead of diagonals.
 */
export function schematicWirePath(
  a: { x: number; y: number },
  b: { x: number; y: number }
): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 0.5 || Math.abs(dy) < 0.5) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  const r = Math.min(12, Math.abs(dx), Math.abs(dy));
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  if (Math.abs(dx) >= Math.abs(dy)) {
    const cx = b.x;
    const cy = a.y;
    return `M ${a.x} ${a.y} L ${cx - sx * r} ${cy} Q ${cx} ${cy} ${cx} ${cy + sy * r} L ${b.x} ${b.y}`;
  }
  const cx = a.x;
  const cy = b.y;
  return `M ${a.x} ${a.y} L ${cx} ${cy - sy * r} Q ${cx} ${cy} ${cx + sx * r} ${cy} L ${b.x} ${b.y}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Freehand wire trails (physical mode)
// ─────────────────────────────────────────────────────────────────────────────

export type Pt = [number, number];

/**
 * Ramer–Douglas–Peucker simplification. Keeps the drawn shape while
 * discarding redundant pointer samples (typically 100+ points → ~10).
 */
export function simplifyTrail(points: Pt[], tolerance = 6): Pt[] {
  if (points.length <= 2) return points.slice();
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [sx, sy] = points[s];
    const [ex, ey] = points[e];
    const dx = ex - sx;
    const dy = ey - sy;
    const segLen = Math.hypot(dx, dy) || 1e-9;
    let maxD = 0;
    let maxI = -1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = points[i];
      // perpendicular distance from point to segment line
      const d = Math.abs(dx * (sy - py) - dy * (sx - px)) / segLen;
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxI !== -1 && maxD > tolerance) {
      keep[maxI] = true;
      stack.push([s, maxI], [maxI, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Smooth an ordered point list into an SVG path using Catmull-Rom → cubic
 * Bezier conversion. Produces a natural, hand-drawn-looking cable curve.
 */
export function smoothTrailPath(points: Pt[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  }
  const p = points;
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    // Catmull-Rom to Bezier (tension = 1/6)
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/**
 * Re-anchor a stored freehand trail onto (possibly moved) endpoints.
 * Interior points are warped proportionally between the old and new
 * endpoints so the drawn shape follows when components are dragged.
 */
export function warpTrail(path: Pt[], a: { x: number; y: number }, b: { x: number; y: number }): Pt[] {
  if (path.length < 2) return [[a.x, a.y], [b.x, b.y]];
  const [ox0, oy0] = path[0];
  const [ox1, oy1] = path[path.length - 1];
  const dAx = a.x - ox0;
  const dAy = a.y - oy0;
  const dBx = b.x - ox1;
  const dBy = b.y - oy1;
  // Fast path: endpoints unchanged
  if (dAx === 0 && dAy === 0 && dBx === 0 && dBy === 0) return path;
  const n = path.length - 1;
  return path.map(([x, y], i) => {
    const t = i / n; // 0 at start, 1 at end
    return [x + dAx * (1 - t) + dBx * t, y + dAy * (1 - t) + dBy * t] as Pt;
  });
}

/** Format a reading value for display; returns an en-dash for missing/NaN. */
export function fmt(v: number | undefined | null, digits = 2): string {
  if (v === undefined || v === null || Number.isNaN(v) || !Number.isFinite(v)) return '–';
  return v.toFixed(digits);
}

/** Parse a meter range string such as '3A' / '15V' / '0.6A' into a numeric max. */
export function parseRangeMax(range: string | undefined, fallback: number): number {
  if (!range) return fallback;
  const m = range.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : fallback;
}
