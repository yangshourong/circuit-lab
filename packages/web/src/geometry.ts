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
 * Compute the outward direction from a terminal pin.
 * For meter/lamp/switch types, uses the physical terminal local offset;
 * for other types, uses the standard pin offset.
 * Returns a unit vector pointing AWAY from the component center.
 */
function terminalOutwardDir(
  comp: PlacedComponent,
  pinId: string,
): { x: number; y: number } {
  let local = meterPhysicalEndpoint
    ? (isMeterType(comp.type) || isLampType(comp.type) || isSwitchType(comp.type) || isMultiSwitchType(comp.type))
      ? (() => {
          // Recompute the local coords to get direction
          if (isMeterType(comp.type)) return meterTerminalLocal(comp, pinId);
          if (isLampType(comp.type) || isSwitchType(comp.type)) return lampTerminalLocal(comp, pinId);
          if (isMultiSwitchType(comp.type)) return multiSwitchTerminalLocal(comp, pinId);
          return null;
        })()
      : null
    : null;
  if (!local) {
    // Standard 2-pin: compute local offset direction
    const off = pinId === 'a' ? -PIN_OFFSET : PIN_OFFSET;
    const rad = ((comp.rotation ?? 0) * Math.PI) / 180;
    local = { x: off * Math.cos(rad), y: off * Math.sin(rad) };
  }
  const len = Math.hypot(local.x, local.y);
  if (len < 0.001) return { x: 1, y: 0 };
  return { x: local.x / len, y: local.y / len };
}

/**
 * Generate default control points for a physical-mode wire between two endpoints.
 * These control points create a natural catenary-like drape with smooth exits
 * from each terminal.
 *
 * The wire path is built as a sequence of key points:
 *   [a, exit_a, ...mid_points..., exit_b, b]
 * which are then smoothed via Catmull-Rom spline.
 */
export function defaultWireControlPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Array<[number, number]> {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  // Very short wires → just two endpoints
  if (len < 30) return [[a.x, a.y], [b.x, b.y]];

  // Unit vector along a→b
  const ux = dx / len;
  const uy = dy / len;

  // Sag direction: prefer gravity (downward) for roughly horizontal wires,
  // or sideways for vertical wires
  let sx: number, sy: number;
  if (Math.abs(dx) >= Math.abs(dy)) {
    sx = 0;
    sy = 1; // gravity down
  } else {
    sy = 0;
    sx = Math.sign(dx) || 1;
  }
  const sLen = Math.hypot(sx, sy);
  sx /= sLen; sy /= sLen;

  // Exit length: how far the wire extends from the terminal before curving
  const exitLen = Math.min(len * 0.15, 20);
  // Sag amount: natural droop proportional to wire length
  const sag = Math.min(Math.max(len * 0.2, 15), 60);

  // Exit points: wire goes straight out from terminal, then curves
  const exitAx = a.x + ux * exitLen;
  const exitAy = a.y + uy * exitLen;
  const exitBx = b.x - ux * exitLen;
  const exitBy = b.y - uy * exitLen;

  // Mid-point with sag: the wire droops between the two exit points
  const midX = (exitAx + exitBx) / 2 + sx * sag;
  const midY = (exitAy + exitBy) / 2 + sy * sag;

  // Two quarter-points for smoother catenary shape
  const q1x = exitAx + (midX - exitAx) * 0.5 + sx * sag * 0.15;
  const q1y = exitAy + (midY - exitAy) * 0.5 + sy * sag * 0.15;
  const q2x = exitBx + (midX - exitBx) * 0.5 + sx * sag * 0.15;
  const q2y = exitBy + (midY - exitBy) * 0.5 + sy * sag * 0.15;

  return [
    [a.x, a.y],
    [exitAx, exitAy],
    [q1x, q1y],
    [midX, midY],
    [q2x, q2y],
    [exitBx, exitBy],
    [b.x, b.y],
  ];
}

/**
 * Build an SVG path string from wire endpoints + optional control points.
 * Uses Catmull-Rom → cubic Bezier for smooth, natural curves.
 *
 * If controlPoints is provided, they are used (after warping to match current
 * endpoints); otherwise, default control points are generated automatically.
 */
export function physicalWirePath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  controlPoints?: Array<[number, number]>,
): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  if (len < 30) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;

  const pts = controlPoints && controlPoints.length >= 2
    ? warpControlPoints(controlPoints, a, b)
    : defaultWireControlPoints(a, b);

  return smoothTrailPath(pts as Pt[]);
}

/**
 * Warp stored control points to follow (possibly moved) endpoints.
 * Similar to warpTrail but for control points: proportionally adjusts
 * all interior points when endpoints change.
 */
export function warpControlPoints(
  pts: Array<[number, number]>,
  a: { x: number; y: number },
  b: { x: number; y: number },
): Array<[number, number]> {
  if (pts.length < 2) return [[a.x, a.y], [b.x, b.y]];
  const [ox0, oy0] = pts[0];
  const [ox1, oy1] = pts[pts.length - 1];
  const dAx = a.x - ox0;
  const dAy = a.y - oy0;
  const dBx = b.x - ox1;
  const dBy = b.y - oy1;
  if (dAx === 0 && dAy === 0 && dBx === 0 && dBy === 0) return pts;
  const n = pts.length - 1;
  return pts.map(([x, y], i) => {
    const t = i / n;
    return [x + dAx * (1 - t) + dBx * t, y + dAy * (1 - t) + dBy * t] as [number, number];
  });
}

/**
 * Mid-point of a physical wire path (for label placement).
 * Evaluates the path at the geometric middle.
 */
export function physicalWireMidpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  controlPoints?: Array<[number, number]>,
): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 30) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  const pts = controlPoints && controlPoints.length >= 2
    ? warpControlPoints(controlPoints, a, b)
    : defaultWireControlPoints(a, b);

  // Return the middle control point (approximate midpoint)
  const mid = pts[Math.floor(pts.length / 2)];
  return { x: mid[0], y: mid[1] };
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
