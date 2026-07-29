// 智能电路实验室 — 电路图自动布局引擎 v10（教材标准单行 + 正交连线）
//
// v1~v5：贪心/BFS/DFS 路径追踪，存在顺序依赖与方向错误。
// v6：改为串并联分解树（SP Decomposition），确定性算法，结果只取决于拓扑。
// v7：正方形网格 + 自动旋转 90° → 对小电路是负优化（竖条比横排更丑）。
// v8：永远单行横排、不折叠 → 用户认为不如方形紧凑。
// v9：蛇形多行折叠求方形 → **纯串联电路被折叠后视觉上像并联（用户反馈"明显连接错误"）**。
// v10（本次）：
//   · **教材级电路（≤12单元）永远单行横排**——不折叠，保证串联/并联视觉正确
//   · 仅超长链（>12 元件，如参数扫描实验）才考虑蛇形折叠
//   · 并联支路在主路**上方**（教材惯例）
//   · 回流线绕最外圈闭合
//   · 转角一律直角（纯 M/L 正交）
//
// 教材规范（人教版九全 第十五章）：
//   电源在左、横平竖直、并联支路在一侧、T 型汇合实心圆点、整体呈矩形回路。

import type { CircuitGraph } from '@circuit/core';

// ─── 结果类型 ────────────────────────────────────────────────
export interface SchematicNode {
  id: string;
  x: number;
  y: number;
  degree: number;
}

export interface SchematicPlacement {
  compId: string;
  x: number;
  y: number;
  pinLeft: 'a' | 'b';
  pinRight: 'a' | 'b';
  isParallel: boolean;
  /** 短路标记：true 表示该元件的两端被导线短路（nA==nB），渲染时建议用虚线/淡色区分 */
  isShorted?: boolean;
  rotation: number; // 保留字段；v8 固定为 0（永远横向）
}

export interface SchematicWire {
  id: string;
  d: string; // 纯 M/L 正交路径
}

export interface SchematicLayout {
  placements: SchematicPlacement[];
  wires: SchematicWire[];
  nodes: SchematicNode[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

// ─── 常量 ────────────────────────────────────────────────
const PIN_HALF = 52;      // 引脚到元件中心距离（须与 art.ts 符号引脚 local x=8/112 → 世界±52 对齐）
const LEAF_W = PIN_HALF * 2; // 104
const COMP_HALF = 35;      // 元件符号半高（art viewBox 0 0 120 70，中心 60,35）
const GAP = 28;             // 串联相邻元件之间的连线长度（均匀间距）
const STUB = 16;            // 并联块两端的水平短接线
const PARALLEL_GAP = 28;    // 并联支路之间的垂直间距
const ROW_GAP = 24;        // 蛇形折叠时行（或列）之间的间距
const RET_MARGIN = 20;      // 回流线距离最底元件的留白

const HIDDEN_TYPES = new Set(['wire', 'annotation']);
const METER_TYPES = new Set(['voltmeter', 'galvanometer']); // 典型并联测量表

// ─── Union-Find ──────────────────────────────────────────
class UnionFind {
  parent = new Map<string, string>();
  size = new Map<string, number>();

  find(id: string): string {
    if (!this.parent.has(id)) { this.parent.set(id, id); this.size.set(id, 1); }
    let p = id;
    while (this.parent.get(p) !== p) p = this.parent.get(p)!;
    let c = id;
    while (this.parent.get(c) !== p) { const n = this.parent.get(c)!; this.parent.set(c, p); c = n; }
    return p;
  }

  union(a: string, b: string): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    const sa = this.size.get(ra)!, sb = this.size.get(rb)!;
    if (sa < sb) { this.parent.set(ra, rb); this.size.set(rb, sa + sb); }
    else { this.parent.set(rb, ra); this.size.set(ra, sa + sb); }
  }
}
function pk(compId: string, pin: string): string {
  return `${compId}:${pin}`;
}

// ─── SP 树类型 ───────────────────────────────────────────
interface SPLeaf {
  kind: 'leaf';
  compId: string;
  type: string;
  nA: string;
  nB: string;
  isHidden: boolean;
}

interface SPSeries {
  kind: 'series';
  children: SPNode[];
  u: string;
  v: string;
}

interface SPParallel {
  kind: 'parallel';
  children: SPNode[];
  u: string;
  v: string;
}

type SPNode = SPLeaf | SPSeries | SPParallel;

function spEnds(n: SPNode): [string, string] {
  return n.kind === 'leaf' ? [n.nA, n.nB] : [n.u, n.v];
}
function otherEnd(n: SPNode, node: string): string {
  const [a, b] = spEnds(n);
  return a === node ? b : a;
}
function countNonMeter(n: SPNode): number {
  if (n.kind === 'leaf') return METER_TYPES.has(n.type) ? 0 : 1;
  return n.children.reduce((s, c) => s + countNonMeter(c), 0);
}
function countAll(n: SPNode): number {
  if (n.kind === 'leaf') return 1;
  return n.children.reduce((s, c) => s + countAll(c), 0);
}

// ─── SP 规约 ─────────────────────────────────────────────
// 返回 { main: 主树（从 S 到 T）, selfLoops: 短路叶子（nA==nB，需要独立展示） }
// 短路叶子在 SP 规约中无法被合并（既不能并联也不能串联），单独返回，
// 在 generateSchematicLayout 中按原始拓扑位置插入主链并补画短路导线。
function spReduce(edges: SPNode[], S: string, T: string): { main: SPNode | null; selfLoops: SPLeaf[] } {
  // 分离自环（短路元件）
  const selfLoops: SPLeaf[] = [];
  const normalEdges: SPNode[] = [];
  for (const e of edges) {
    const [a, b] = spEnds(e);
    if (a === b && e.kind === 'leaf') {
      selfLoops.push(e);
    } else {
      normalEdges.push(e);
    }
  }
  let list = [...normalEdges];
  for (let iter = 0; iter < 200; iter++) {
    let changed = false;
    const byPair = new Map<string, SPNode[]>();
    for (const e of list) {
      const [a, b] = spEnds(e);
      if (a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!byPair.has(key)) byPair.set(key, []);
      byPair.get(key)!.push(e);
    }
    for (const group of byPair.values()) {
      if (group.length >= 2) {
        const [a, b] = spEnds(group[0]);
        const children: SPNode[] = [];
        for (const g of group) {
          if (g.kind === 'parallel') children.push(...g.children);
          else children.push(g);
        }
        const merged: SPParallel = { kind: 'parallel', children, u: a, v: b };
        list = list.filter(e => !group.includes(e));
        list.push(merged);
        changed = true;
        break;
      }
    }
    if (changed) continue;
    const incidence = new Map<string, SPNode[]>();
    for (const e of list) {
      const [a, b] = spEnds(e);
      for (const n of [a, b]) {
        if (!incidence.has(n)) incidence.set(n, []);
        incidence.get(n)!.push(e);
      }
    }
    for (const [node, inc] of incidence) {
      if (node === S || node === T) continue;
      if (inc.length !== 2 || inc[0] === inc[1]) continue;
      const [e1, e2] = inc;
      const u = otherEnd(e1, node);
      const v = otherEnd(e2, node);
      const children: SPNode[] = [];
      const append = (e: SPNode, from: string) => {
        if (e.kind === 'series') {
          const cs = e.u === from ? e.children : [...e.children].reverse();
          children.push(...cs);
        } else {
          children.push(e);
        }
      };
      append(e1, u);
      append(e2, node);
      const merged: SPSeries = { kind: 'series', children, u, v };
      list = list.filter(e => e !== e1 && e !== e2);
      list.push(merged);
      changed = true;
      break;
    }
    if (!changed) break;
  }
  if (list.length === 1) {
    const [a, b] = spEnds(list[0]);
    if ((a === S && b === T) || (a === T && b === S)) return { main: list[0], selfLoops };
  }
  return { main: null, selfLoops };
}

// ─── 规范块（canonical block） ──────────────────────────
interface JuncNode { x: number; y: number; nodeId: string; }
interface Block {
  len: number;            // 沿引脚轴长度（A→B 距离）
  perpMin: number;       // 垂直于轴方向的最小偏移（相对 y=0）
  perpMax: number;       // 垂直于轴方向的最大偏移
  placements: SchematicPlacement[];
  wires: SchematicWire[];
  junctions: JuncNode[];
}

let wireSeq = 0;
function wid(tag: string): string {
  return `sch:${tag}:${wireSeq++}`;
}

let nodeDegree = new Map<string, number>();

// 平移纯 M/L 路径
function translatePathSimple(d: string, dx: number, dy: number): string {
  const tokens = d.trim().split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'M' || t === 'L') {
      out.push(t, String(parseFloat(tokens[i + 1]) + dx), String(parseFloat(tokens[i + 2]) + dy));
      i += 2;
    } else {
      out.push(t);
    }
  }
  return out.join(' ');
}

// 两点的正交连线（右转角：先沿前者坐标轴，再沿后者）
function connectPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  if (Math.abs(a.y - b.y) < 0.5) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  if (Math.abs(a.x - b.x) < 0.5) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  return `M ${a.x} ${a.y} L ${a.x} ${b.y} L ${b.x} ${b.y}`;
}

function layoutLeaf(l: SPLeaf, entryNode: string): Block {
  if (l.isHidden) {
    return { len: 0, perpMin: 0, perpMax: 0, placements: [], wires: [], junctions: [] };
  }
  const pinLeft: 'a' | 'b' = l.nA === entryNode ? 'a' : 'b';
  const pinRight: 'a' | 'b' = pinLeft === 'a' ? 'b' : 'a';
  const leftNode = pinLeft === 'a' ? l.nA : l.nB;
  const rightNode = pinRight === 'a' ? l.nA : l.nB;
  const junc: JuncNode[] = [
    { x: 0, y: 0, nodeId: leftNode },
    { x: LEAF_W, y: 0, nodeId: rightNode },
  ];
  return {
    len: LEAF_W,
    perpMin: -COMP_HALF,
    perpMax: COMP_HALF,
    placements: [{ compId: l.compId, x: LEAF_W / 2, y: 0, pinLeft, pinRight, isParallel: false, rotation: 0 }],
    wires: [],
    junctions: junc,
  };
}

/**
 * 短路叶子布局（nA == nB，被导线短路的元件）：
 * - 元件仍占 LEAF_W 宽度，插入主链
 * - 在元件下方画一条横跨引脚的短路导线（明示"被短路"的物理意义）
 * - 两个引脚虽然在同一个电气节点（nodeId），但视觉上分别在元件左右两端
 * - 标注 isShorted=true，便于外部样式区分（如虚线/淡色）
 */
function layoutShortedLeaf(l: SPLeaf): Block {
  const nodeId = l.nA; // nA == nB
  const shortY = 8; // 短路导线在元件下方 8 像素
  return {
    len: LEAF_W,
    perpMin: -COMP_HALF,
    perpMax: COMP_HALF,
    placements: [{
      compId: l.compId,
      x: LEAF_W / 2,
      y: 0,
      pinLeft: 'a',
      pinRight: 'b',
      isParallel: false,
      rotation: 0,
      // 用 isShorted 标识（扩展字段，不影响现有逻辑）
      ...({ isShorted: true } as { isShorted: boolean }),
    }],
    // 短路导线：从左引脚下方横拉到右引脚下方
    wires: [{ id: wid('sh'), d: `M 0 ${shortY} L ${LEAF_W} ${shortY}` }],
    junctions: [
      { x: 0, y: 0, nodeId },
      { x: LEAF_W, y: 0, nodeId },
    ],
  };
}

function layoutSeries(n: SPSeries, entryNode: string): Block {
  const ordered = n.u === entryNode ? n.children : [...n.children].reverse();
  const placements: SchematicPlacement[] = [];
  const wires: SchematicWire[] = [];
  const junctions: JuncNode[] = [];
  let x = 0;
  let prevExit: { x: number; y: number } | null = null;
  let perpMin = 0, perpMax = 0;
  for (const c of ordered) {
    const b = layoutNode(c, entryNode);
    if (prevExit) {
      const entry = { x, y: 0 };
      wires.push({ id: wid('s'), d: connectPath(prevExit, entry) });
    }
    for (const p of b.placements) placements.push({ ...p, x: p.x + x, y: p.y });
    for (const w of b.wires) wires.push({ id: w.id, d: translatePathSimple(w.d, x, 0) });
    for (const j of b.junctions) junctions.push({ ...j, x: j.x + x });
    perpMin = Math.min(perpMin, b.perpMin);
    perpMax = Math.max(perpMax, b.perpMax);
    const exit = { x: x + b.len, y: 0 };
    prevExit = exit;
    x += b.len + GAP;
  }
  x -= GAP;
  junctions.push({ x: 0, y: 0, nodeId: entryNode });
  junctions.push({ x, y: 0, nodeId: otherEnd(n, entryNode) });
  return { len: x, perpMin, perpMax, placements, wires, junctions };
}

function layoutParallel(n: SPParallel, entryNode: string): Block {
  const exitNode = otherEnd(n, entryNode);
  // 选主支路：非电表元件最多者优先
  const children = [...n.children].sort((p, q) => {
    const d = countNonMeter(q) - countNonMeter(p);
    if (d !== 0) return d;
    return countAll(q) - countAll(p);
  });
  const main = children[0];
  const mainBlock = layoutNode(main, entryNode);
  const mainLen = mainBlock.len;

  const placements: SchematicPlacement[] = [];
  const wires: SchematicWire[] = [];
  const junctions: JuncNode[] = [];

  // 主支路从 STUB 开始（为 pl/pr 短接线预留水平空间）
  const mainX = STUB;

  // ── 左右 stub 线（关键！修复断点）──────────────────────────
  // 块的逻辑入口在 (0, 0)，但主支路左引脚在 (mainX, 0)。
  // 外部连线只能到达块入口，所以必须补一段 stub 线把块入口连到主支路左引脚。
  // 右侧同理：主支路右引脚在 (mainX+mainLen, 0)，块出口在 (len, 0)，需补 stub。
  if (mainX > 0) {
    wires.push({ id: wid('stub_l'), d: connectPath({ x: 0, y: 0 }, { x: mainX, y: 0 }) });
  }

  // 主支路布局
  for (const p of mainBlock.placements) placements.push({ ...p, x: p.x + mainX });
  for (const w of mainBlock.wires) wires.push({ id: w.id, d: translatePathSimple(w.d, mainX, 0) });

  // 侧支路：在主路**上方**依次堆叠（−y 方向，教材惯例：并联在被测元件上方）
  // 起始 yCursor = 第一个侧支路的圆心位置
  // 要求：侧支路底部（yCursor + COMP_HALF）≤ 主支路顶部（-COMP_HALF）+ PARALLEL_GAP
  //   ⇒ yCursor ≤ -2*COMP_HALF - PARALLEL_GAP
  let yCursor = -(2 * COMP_HALF + PARALLEL_GAP);
  let maxSideRight = mainLen;
  for (let i = 1; i < children.length; i++) {
    const sb = layoutNode(children[i], entryNode);
    const cx = (mainLen - sb.len) / 2; // 侧支路水平居中于主支路
    const ox = mainX + cx;
    for (const p of sb.placements) placements.push({ ...p, x: p.x + ox, y: p.y + yCursor });
    for (const w of sb.wires) wires.push({ id: w.id, d: translatePathSimple(w.d, ox, yCursor) });
    // 两端短接：主路 → 侧支路（向上引出）
    wires.push({ id: wid('pl'), d: connectPath({ x: mainX, y: 0 }, { x: mainX + cx, y: yCursor }) });
    wires.push({ id: wid('pr'), d: connectPath({ x: mainX + cx + sb.len, y: yCursor }, { x: mainX + mainLen, y: 0 }) });
    maxSideRight = Math.max(maxSideRight, cx + sb.len);
    yCursor -= (sb.perpMax - sb.perpMin) + PARALLEL_GAP;
  }

  const perpMin = yCursor + PARALLEL_GAP + Math.min(0, mainBlock.perpMin); // 上方支路可能更靠上
  const perpMax = Math.max(COMP_HALF, mainBlock.perpMax);
  const len = STUB * 2 + Math.max(mainLen, maxSideRight);

  // 右侧 stub 线（关键！修复断点）
  if (mainX + mainLen < len) {
    wires.push({ id: wid('stub_r'), d: connectPath({ x: mainX + mainLen, y: 0 }, { x: len, y: 0 }) });
  }

  junctions.push({ x: mainX, y: 0, nodeId: entryNode });
  junctions.push({ x: mainX + mainLen, y: 0, nodeId: exitNode });

  // 标记侧支路元件为并联
  const mainCompIds = new Set(mainBlock.placements.map(p => p.compId));
  for (const p of placements) if (!mainCompIds.has(p.compId)) p.isParallel = true;

  return { len, perpMin, perpMax, placements, wires, junctions };
}

function layoutNode(n: SPNode, entryNode: string): Block {
  if (n.kind === 'leaf') return layoutLeaf(n, entryNode);
  if (n.kind === 'series') return layoutSeries(n, entryNode);
  return layoutParallel(n, entryNode);
}

// 将 SP 树展平为有序的"原子块"列表（串联链顺序；并联子块作为一个整体单元）
function flatten(node: SPNode, entryNode: string): Block[] {
  if (node.kind === 'leaf') return [layoutNode(node, entryNode)];
  if (node.kind === 'series') {
    const ordered = node.u === entryNode ? node.children : [...node.children].reverse();
    const out: Block[] = [];
    let cur = entryNode;
    for (const c of ordered) {
      out.push(...flatten(c, cur));
      cur = otherEnd(c, cur);
    }
    return out;
  }
  // parallel：必须作为一个整体块（内部短接连接 u/v 两端），不可展开为顺序单元
  return [layoutParallel(node, entryNode)];
}

// ─── 蛇形（serpentine）多行布局（教材标准：横向、不旋转）──────────
// 所有单元按网格排列，行内左→右、行间折返右→左。
// 元件始终横向（rotation=0），不旋转；自动选行数使整体接近正方形。
interface GridResult {
  placements: SchematicPlacement[];
  wires: SchematicWire[];
  junctions: JuncNode[];
  minX: number; minY: number; maxX: number; maxY: number;
  lastExit: { x: number; y: number };
}

function emitBlock(b: Block, ox: number, oy: number, placements: SchematicPlacement[], wires: SchematicWire[], junctions: JuncNode[]): void {
  for (const p of b.placements) placements.push({ ...p, x: p.x + ox, y: p.y + oy });
  for (const w of b.wires) wires.push({ id: w.id, d: translatePathSimple(w.d, ox, oy) });
  for (const j of b.junctions) {
    const x = j.x + ox, y = j.y + oy;
    if ((nodeDegree.get(j.nodeId) ?? 0) >= 3) junctions.push({ x, y, nodeId: j.nodeId });
  }
}

// 蛇形（serpentine）多行布局：行内左→右，行间折返（右→左）。
// 元件永远横向（rotation=0），不旋转；自动选行数使整体接近正方形。
function serpentineLayout(units: Block[], rows: number): GridResult {
  const n = units.length;
  const cols = Math.ceil(n / rows);

  // 每列最大单元长度 → 列宽与列起始 x
  const colW: number[] = new Array(cols).fill(0);
  for (let i = 0; i < n; i++) colW[i % cols] = Math.max(colW[i % cols], units[i].len);
  const colX: number[] = [0];
  for (let c = 1; c < cols; c++) colX[c] = colX[c - 1] + colW[c - 1] + GAP;

  const unitH = Math.max(1, ...units.map(u => u.perpMax - u.perpMin));
  const pitchY = unitH + ROW_GAP;

  const placements: SchematicPlacement[] = [];
  const wires: SchematicWire[] = [];
  const junctions: JuncNode[] = [];
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  const acc = (x: number, y: number) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };

  let prevExit: { x: number; y: number } | null = null;
  for (let r = 0; r < rows; r++) {
    const rowUnits = units.slice(r * cols, Math.min((r + 1) * cols, n));
    const dir = r % 2 === 0 ? 1 : -1; // 偶数行左→右，奇数行右→左
    const rowLen = rowUnits.length;
    for (let k = 0; k < rowLen; k++) {
      const u = rowUnits[k];
      const colPos = dir > 0 ? k : (cols - 1 - k);
      const x = colX[colPos];
      const y = r * pitchY;
      const entry = { x, y };
      if (prevExit) wires.push({ id: wid('s'), d: connectPath(prevExit, entry) });
      emitBlock(u, x, y, placements, wires, junctions);
      acc(x, y + u.perpMin);
      acc(x + u.len, y + u.perpMax);
      prevExit = { x: x + u.len, y };
    }
  }

  return { placements, wires, junctions, minX, minY, maxX, maxY, lastExit: prevExit! };
}

// 遍历 1..n 行，选宽高比最接近 1:1（尽可能正方形）者
// 注意：含并联支路的块（perpMin 显著为负）不宜折叠，
// 否则并联块被当成普通单元塞进网格，割裂"主链+并联在上"的教材结构。
function chooseSerpentine(units: Block[]): GridResult {
  const n = units.length;
  // 教材级电路（≤12 单元）永远单行横排——折叠会导致串联元件错位到不同行，
  // 视觉上看起来像并联分支（用户已反馈"明显连接错误"）。
  // 只有超长链（>12 元件，如元件参数扫描实验）才考虑折叠。
  const maxRows = n > 12 ? n : 1;
  let best: { res: GridResult; score: number } | null = null;
  for (let rows = 1; rows <= maxRows; rows++) {
    const res = serpentineLayout(units, rows);
    const w = res.maxX - res.minX, h = res.maxY - res.minY;
    const ar = w / Math.max(1, h);
    const score = Math.max(ar, 1 / ar); // 偏离 1 的程度，越小越方
    if (!best || score < best.score) best = { res, score };
  }
  return best!.res;
}

// ─── 核心 API ──────────────────────────────────────────────
export function generateSchematicLayout(graph: CircuitGraph): SchematicLayout {
  wireSeq = 0;

  const uf = new UnionFind();
  for (const w of graph.wires) {
    uf.union(pk(w.from.componentId, w.from.pin), pk(w.to.componentId, w.to.pin));
  }
  const allComps = graph.components;
  if (allComps.length === 0) return emptyLayout();

  const leaves: SPLeaf[] = allComps.map(c => ({
    kind: 'leaf' as const,
    compId: c.id,
    type: c.type,
    nA: uf.find(pk(c.id, 'a')),
    nB: uf.find(pk(c.id, 'b')),
    isHidden: HIDDEN_TYPES.has(c.type),
  }));

  nodeDegree = new Map<string, number>();
  for (const l of leaves) {
    nodeDegree.set(l.nA, (nodeDegree.get(l.nA) ?? 0) + 1);
    nodeDegree.set(l.nB, (nodeDegree.get(l.nB) ?? 0) + 1);
  }

  const batteryLeaf = leaves.find(l => l.type === 'battery');
  let grid: GridResult | null = null;

  if (batteryLeaf && batteryLeaf.nA !== batteryLeaf.nB) {
    const S = batteryLeaf.nA;
    const T = batteryLeaf.nB;
    const external = leaves.filter(l => l !== batteryLeaf);
    if (external.length > 0) {
      const result = spReduce([...external], S, T);
      const tree = result.main;
      const selfLoops = result.selfLoops;
      if (tree) {
        // 电池作为第 0 个单元（entry=T/− 在左，exit=S/+ 在右）
        const batteryBlock = layoutLeaf(batteryLeaf, T);
        const units = [batteryBlock, ...flatten(tree, S)];
        // 短路叶子（nA==nB）作为独立单元追加到主链末端，并画短路导线
        for (const sl of selfLoops) {
          units.push(layoutShortedLeaf(sl));
        }
        // 蛇形多行折叠，自动选行数使整体接近正方形（元件始终横向）
        const east = chooseSerpentine(units);
        // 回流线：绕最外圈闭合（leftX 在整体最左外侧，避免贴着左侧元件列）
        const bottomY = east.maxY + RET_MARGIN;
        const leftX = east.minX - GAP;
        const batEntryX = 0; // 电池左引脚（units[0] 块原点在 (0,0)）
        const retWires: SchematicWire[] = [
          { id: wid('ret1'), d: connectPath(east.lastExit, { x: east.lastExit.x, y: bottomY }) },
          { id: wid('ret2'), d: connectPath({ x: east.lastExit.x, y: bottomY }, { x: leftX, y: bottomY }) },
          { id: wid('ret3'), d: connectPath({ x: leftX, y: bottomY }, { x: leftX, y: 0 }) },
          { id: wid('ret4'), d: connectPath({ x: leftX, y: 0 }, { x: batEntryX, y: 0 }) },
        ];
        grid = { ...east, wires: [...east.wires, ...retWires], maxY: bottomY, minX: Math.min(east.minX, leftX) };
      }
    }
  }

  if (!grid) {
    // 回退：全部串联横排一行
    const ordered = batteryLeaf && !batteryLeaf.isHidden
      ? [batteryLeaf, ...leaves.filter(l => !l.isHidden && l !== batteryLeaf)]
      : leaves.filter(l => !l.isHidden);
    const units: Block[] = ordered.map(l => layoutLeaf(l, l.nA));
    const east = chooseSerpentine(units);
    const bottomY = east.maxY + RET_MARGIN;
    const retWires: SchematicWire[] = [
      { id: wid('ret1'), d: connectPath(east.lastExit, { x: east.lastExit.x, y: bottomY }) },
      { id: wid('ret2'), d: connectPath({ x: east.lastExit.x, y: bottomY }, { x: 0, y: bottomY }) },
      { id: wid('ret3'), d: connectPath({ x: 0, y: bottomY }, { x: 0, y: 0 }) },
    ];
    grid = { ...east, wires: [...east.wires, ...retWires], maxY: bottomY };
  }

  // ── 居中 + 汇合圆点 ──
  const offX = -grid.minX;
  const offY = -grid.minY;
  const placements = grid.placements.map(p => ({ ...p, x: p.x + offX, y: p.y + offY }));
  const wires = grid.wires.map(w => ({ id: w.id, d: translatePathSimple(w.d, offX, offY) }));
  const nodes: SchematicNode[] = [];
  const seen = new Set<string>();
  for (const j of grid.junctions) {
    const key = `${j.nodeId}@${Math.round(j.x + offX)},${Math.round(j.y + offY)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nodes.push({ id: key, x: j.x + offX, y: j.y + offY, degree: nodeDegree.get(j.nodeId) ?? 0 });
  }
  const bounds = {
    minX: grid.minX + offX,
    minY: grid.minY + offY,
    maxX: grid.maxX + offX,
    maxY: grid.maxY + offY,
  };
  return { placements, wires, nodes, bounds };
}

function emptyLayout(): SchematicLayout {
  return { placements: [], wires: [], nodes: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
}
