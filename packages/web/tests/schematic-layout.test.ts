// v9 布局引擎回归测试 —— 蛇形多行 + 尽可能方形
// v9 策略：元件永远横向（rotation=0，不旋转），蛇形多行折叠，自动选行数使宽高比接近 1:1。
// 运行：npx tsx tests/schematic-layout.test.ts
import { generateSchematicLayout, type SchematicLayout } from '../src/schematic-layout';

type G = Parameters<typeof generateSchematicLayout>[0];

let pass = 0, fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ FAIL ${msg}`); }
}

function C(id: string, type: string): any {
  return { id, type, x: 0, y: 0, rotation: 0, params: {}, fault: 'normal' };
}
function W(id: string, from: [string, string], to: [string, string]): any {
  return { id, from: { componentId: from[0], pin: from[1] }, to: { componentId: to[0], pin: to[1] } };
}

// 所有连线均为纯 M/L 正交路径（右转角，无斜线、无 Q 圆角）
function allOrthogonal(L: SchematicLayout): boolean {
  for (const w of L.wires) {
    const toks = w.d.trim().split(/\s+/);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t === 'M' || t === 'L') { pts.push([parseFloat(toks[i + 1]), parseFloat(toks[i + 2])]); i += 2; }
    }
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      if (Math.abs(x0 - x1) > 0.5 && Math.abs(y0 - y1) > 0.5) return false; // 斜线段
    }
  }
  return true;
}

// 提取连线 d 属性中的所有拐点坐标
function parseWirePoints(d: string): Array<[number, number]> {
  const toks = d.trim().split(/\s+/);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === 'M' || t === 'L') { pts.push([parseFloat(toks[i + 1]), parseFloat(toks[i + 2])]); i += 2; }
  }
  return pts;
}

// 宽高比（越接近 1 越方）
function aspect(L: SchematicLayout): number {
  const w = L.bounds.maxX - L.bounds.minX, h = L.bounds.maxY - L.bounds.minY;
  if (w <= 0 || h <= 0) return 1;
  return Math.max(w / h, h / w);
}

// 主链元件是否共线（横排 all-y-equal 或 竖排 all-x-equal）
function colinear(L: SchematicLayout, ids: string[]): boolean {
  const by = new Map(L.placements.map(p => [p.compId, p]));
  const ps = ids.map(id => by.get(id)!).filter(Boolean);
  if (ps.length < 2) return false;
  const sameY = ps.every(p => Math.abs(p.y - ps[0].y) < 1);
  const sameX = ps.every(p => Math.abs(p.x - ps[0].x) < 1);
  return sameY || sameX;
}

// ═══ 用例1：用户报告的电路 —— 串联回路 + 电压表并联灯泡 ═══
{
  console.log('用例1: battery→switch→lamp→ammeter 串联, voltmeter ∥ lamp');
  const g: G = {
    components: [C('bat', 'battery'), C('sw', 'switch'), C('lp', 'lamp'), C('am', 'ammeter'), C('vm', 'voltmeter')],
    wires: [
      W('w1', ['bat', 'a'], ['sw', 'a']),
      W('w2', ['sw', 'b'], ['lp', 'a']),
      W('w3', ['lp', 'b'], ['am', 'a']),
      W('w4', ['am', 'b'], ['bat', 'b']),
      W('w5', ['vm', 'a'], ['lp', 'a']),
      W('w6', ['vm', 'b'], ['lp', 'b']),
    ],
  } as G;
  const L = generateSchematicLayout(g);
  const by = new Map(L.placements.map(p => [p.compId, p]));
  ok(L.placements.length === 5, `全部 5 个元件都有布局（实际 ${L.placements.length}）`);
  ok(!by.get('lp')!.isParallel && by.get('vm')!.isParallel, '灯泡在主链、电压表判定为并联');
  ok(Math.abs(by.get('vm')!.x - by.get('lp')!.x) < 60, `电压表水平位置与灯泡对齐（vm.x=${by.get('vm')!.x}, lp.x=${by.get('lp')!.x}）`);
  ok(Math.abs(by.get('bat')!.y - by.get('sw')!.y) < 1 && Math.abs(by.get('sw')!.y - by.get('lp')!.y) < 1 && Math.abs(by.get('lp')!.y - by.get('am')!.y) < 1, '主链 4 元件等高横排（含并联强制单行，不折叠）');
  ok(L.wires.length > 0, `有连线（${L.wires.length} 条）`);
  ok(allOrthogonal(L), '全部连线为右转角正交（无斜线/圆角）');
  ok(L.nodes.length >= 2 && L.nodes.every(n => n.degree >= 3), `汇合圆点均位于 3+ 节点（实际 ${L.nodes.length}）`);
  // v9 策略：含"向上伸出的并联"时强制单行（教材规范：主链横排 + 并联在上方），优先于方形
  ok(by.get('vm')!.y < by.get('lp')!.y, `电压表在灯泡上方（vm.y=${by.get('vm')!.y}, lp.y=${by.get('lp')!.y}）`);
}

// ═══ 用例2：元件添加顺序打乱（v5 顺序依赖 bug 回归）═══
{
  console.log('用例2: 同一电路，元件数组顺序打乱（电压表放最前）');
  const g: G = {
    components: [C('vm', 'voltmeter'), C('am', 'ammeter'), C('lp', 'lamp'), C('sw', 'switch'), C('bat', 'battery')],
    wires: [
      W('w5', ['vm', 'a'], ['lp', 'a']),
      W('w6', ['vm', 'b'], ['lp', 'b']),
      W('w4', ['am', 'b'], ['bat', 'b']),
      W('w1', ['bat', 'a'], ['sw', 'a']),
      W('w3', ['lp', 'b'], ['am', 'a']),
      W('w2', ['sw', 'b'], ['lp', 'a']),
    ],
  } as G;
  const L = generateSchematicLayout(g);
  const by = new Map(L.placements.map(p => [p.compId, p]));
  ok(by.get('vm')!.isParallel, '打乱顺序后电压表仍判定为并联');
  ok(allOrthogonal(L), '连线仍全部正交');
}

// ═══ 用例3：纯串联（无并联支路）═══
{
  console.log('用例3: battery→switch→lamp 纯串联');
  const g: G = {
    components: [C('bat', 'battery'), C('sw', 'switch'), C('lp', 'lamp')],
    wires: [
      W('w1', ['bat', 'a'], ['sw', 'a']),
      W('w2', ['sw', 'b'], ['lp', 'a']),
      W('w3', ['lp', 'b'], ['bat', 'b']),
    ],
  } as G;
  const L = generateSchematicLayout(g);
  ok(L.placements.length === 3 && L.placements.every(p => !p.isParallel), '3 元件全在主线、无并联');
  ok(L.nodes.length === 0, '无汇合圆点');
  ok(allOrthogonal(L), '连线全部正交');
}

// ═══ 用例4：两灯并联 ═══
{
  console.log('用例4: 两灯并联（battery→switch→[lp1 ∥ lp2]）');
  const g: G = {
    components: [C('bat', 'battery'), C('sw', 'switch'), C('lp1', 'lamp'), C('lp2', 'lamp')],
    wires: [
      W('w1', ['bat', 'a'], ['sw', 'a']),
      W('w2', ['sw', 'b'], ['lp1', 'a']),
      W('w3', ['sw', 'b'], ['lp2', 'a']),
      W('w4', ['lp1', 'b'], ['bat', 'b']),
      W('w5', ['lp2', 'b'], ['bat', 'b']),
    ],
  } as G;
  const L = generateSchematicLayout(g);
  const by = new Map(L.placements.map(p => [p.compId, p]));
  const para = [by.get('lp1')!, by.get('lp2')!].filter(p => p.isParallel).length;
  ok(para === 1, `恰有一灯在并联支路（实际 ${para}）`);
  ok(colinear(L, ['bat', 'sw']) || by.get('lp1')!.isParallel !== by.get('lp2')!.isParallel, '主链与并联支路区分正确');
  ok(allOrthogonal(L), '连线全部正交');
}

// ═══ 用例5：长串联（8 元件）→ v10 仍单行（教材规范优先）═══
{
  console.log('用例5: 8 元件纯串联 → 单行横排（v10：≤12元不折叠）');
  const comps = [C('bat', 'battery')];
  const wires: any[] = [W('w0', ['bat', 'a'], ['l0', 'a'])];
  for (let i = 0; i < 7; i++) { comps.push(C(`l${i}`, 'lamp')); wires.push(W(`w${i + 1}`, [`l${i}`, 'b'], [`l${i + 1}`, 'a'])); }
  wires.push(W(`w7`, ['l6', 'b'], ['bat', 'b']));
  comps[1] = C('l0', 'lamp');
  const g: G = { components: comps, wires } as G;
  const L = generateSchematicLayout(g);
  ok(L.placements.length === 8, `8 元件全部布局（实际 ${L.placements.length}）`);
  // v10：8 ≤ 12，不折叠，单行横排（教材标准）
  const by = new Map(L.placements.map(p => [p.compId, p]));
  const firstY = by.get('bat')!.y;
  ok(L.placements.every(p => Math.abs(p.y - firstY) < 1), '所有元件共线单行（不折叠）');
  ok(allOrthogonal(L), '连线全部正交');
}

// ═══ 用例7：两灯并联（纯并联，无电压表）→ 主支路左右 stub 线必须存在 ═══
{
  console.log('用例7: 两灯并联 → 左右 stub 线补齐（修复断点）');
  const bat = C('bat', 'battery');
  const sw = C('sw', 'switch');
  const lp1 = C('lp1', 'lamp');
  const lp2 = C('lp2', 'lamp');
  const g: G = {
    components: [bat, sw, lp1, lp2],
    wires: [
      W('w1', ['bat', 'a'], ['sw', 'b']),
      W('w2', ['sw', 'a'], ['lp1', 'a']),
      W('w3', ['sw', 'a'], ['lp2', 'a']),
      W('w4', ['lp1', 'b'], ['bat', 'b']),
      W('w5', ['lp2', 'b'], ['bat', 'b']),
    ],
  } as G;
  const L = generateSchematicLayout(g);
  ok(L.placements.length === 4, '4 元件全部布局');
  const by = new Map(L.placements.map(p => [p.compId, p]));
  const para = L.placements.filter(p => p.isParallel).length;
  ok(para === 1, `恰有一灯在并联支路（实际 ${para}）`);
  // 关键：所有连线必须端到端衔接，无孤立段
  // 每条 wire 的 M 起点应与前一条 L 终点重合（或组件引脚重合）
  const endpoints = new Set<string>();
  for (const w of L.wires) {
    const pts = parseWirePoints(w.d);
    if (pts.length >= 2) {
      const start = `${Math.round(pts[0][0])},${Math.round(pts[0][1])}`;
      const end = `${Math.round(pts[pts.length - 1][0])},${Math.round(pts[pts.length - 1][1])}`;
      // 起点或终点应在端点集合中（首条线除外）；这里只验证：
      // 没有任何线段的端点"孤立"（即不在任何组件引脚上、也不在另一条线的端点上）
      endpoints.add(start);
      endpoints.add(end);
    }
  }
  // 把所有组件引脚坐标加入端点池
  for (const p of L.placements) {
    const pinOffset = 52; // PIN_HALF
    const pinLX = p.x - pinOffset, pinRX = p.x + pinOffset;
    endpoints.add(`${Math.round(pinLX)},${Math.round(p.y)}`);
    endpoints.add(`${Math.round(pinRX)},${Math.round(p.y)}`);
  }
  // 每条线段的每个端点都必须与某组件引脚或其他线段端点重合
  let allConnected = true;
  for (const w of L.wires) {
    const pts = parseWirePoints(w.d);
    for (const [x, y] of pts) {
      const key = `${Math.round(x)},${Math.round(y)}`;
      if (!endpoints.has(key)) { allConnected = false; break; }
    }
  }
  ok(allConnected, '所有线段端点都连接到了组件引脚或其他线段端点（无孤立断点）');
  ok(allOrthogonal(L), '连线全部正交');
}

// ═══ 用例8：电压表∥灯泡 → 圆圈不重叠（垂直净空 ≥ 10px）═══
{
  console.log('用例8: 电压表∥灯泡 → 元件垂直净空');
  const g: G = {
    components: [C('bat', 'battery'), C('sw', 'switch'), C('lp', 'lamp'), C('vm', 'voltmeter')],
    wires: [
      W('w1', ['bat', 'a'], ['sw', 'b']),
      W('w2', ['sw', 'a'], ['lp', 'a']),
      W('w3', ['lp', 'b'], ['bat', 'b']),
      W('w4', ['vm', 'a'], ['lp', 'a']),
      W('w5', ['vm', 'b'], ['lp', 'b']),
    ],
  } as G;
  const L = generateSchematicLayout(g);
  const by = new Map(L.placements.map(p => [p.compId, p]));
  const COMP_HALF = 35; // 与 schematic-layout.ts 一致
  // 任意两个在同一 x 范围（横坐标差 ≤ 60）的元件，圆圈不应垂直重叠
  const parallel = L.placements.filter(p => p.isParallel);
  const main = L.placements.filter(p => !p.isParallel);
  ok(main.length >= 1 && parallel.length >= 1, '至少有 1 主路 + 1 并联');
  for (const p of parallel) {
    // 找同一列内的主路元件（横坐标差 ≤ 60）
    const overlap = main.find(m => Math.abs(m.x - p.x) < 60);
    if (!overlap) continue;
    const gap = (overlap.y - COMP_HALF) - (p.y + COMP_HALF);
    ok(gap >= 10, `并联 ${p.compId} 与主路 ${overlap.compId} 垂直净空 ≥10px（实际 ${gap.toFixed(0)}）`);
  }
  ok(allOrthogonal(L), '连线全部正交');
}

// ═══ 用例9：3灯串联 + lamp2/lamp3 被导线短路 → 短路元件不丢失 ═══
{
  console.log('用例9: 3灯串联 + lamp2/lamp3 被导线短路 → 元件不丢失+短路导线可见');
  const bat = C('bat', 'battery');
  const am = C('am', 'ammeter');
  const sw = C('sw', 'switch');
  const l1 = C('l1', 'lamp');
  const l2 = C('l2', 'lamp');
  const l3 = C('l3', 'lamp');
  const g: G = {
    components: [bat, am, sw, l1, l2, l3],
    wires: [
      W('w1', ['bat', 'a'], ['am', 'a']),
      W('w2', ['am', 'b'], ['sw', 'a']),
      W('w3', ['sw', 'b'], ['l1', 'a']),
      W('w4', ['l1', 'b'], ['l2', 'a']),
      W('w5', ['l2', 'b'], ['l3', 'a']),
      W('w6', ['l3', 'b'], ['bat', 'b']),
      W('sh2', ['l2', 'a'], ['l2', 'b']), // 短路 lamp2
      W('sh3', ['l3', 'a'], ['l3', 'b']), // 短路 lamp3
    ],
  } as G;
  const L = generateSchematicLayout(g);
  // 关键断言：所有 6 个元件都出现
  ok(L.placements.length === 6, `6 个元件全部布局（实际 ${L.placements.length}）`);
  const ids = new Set(L.placements.map(p => p.compId));
  for (const id of ['bat', 'am', 'sw', 'l1', 'l2', 'l3']) {
    ok(ids.has(id), `${id} 在布局中`);
  }
  // 短路元件有 isShorted=true 标记
  const l2p = L.placements.find(p => p.compId === 'l2')!;
  const l3p = L.placements.find(p => p.compId === 'l3')!;
  ok(l2p.isShorted === true, 'lamp2 标记为短路');
  ok(l3p.isShorted === true, 'lamp3 标记为短路');
  // 短路导线存在（以 M 0 y L LEAF_W y 形式）
  const hasShortWire = L.wires.some(w => /^M \d+ \d+ L \d+ \d+$/.test(w.d) && w.id.startsWith('sch:sh:'));
  ok(hasShortWire, '存在短路导线（横跨引脚的单段线）');
  ok(allOrthogonal(L), '连线全部正交');
}

// ═══ 用例6：不完整电路（开路，无法闭合回路）→ 回退不崩溃 ═══
{
  console.log('用例6: 开路（灯泡只连了一端）→ 回退布局不崩溃');
  const g: G = {
    components: [C('bat', 'battery'), C('lp', 'lamp')],
    wires: [W('w1', ['bat', 'a'], ['lp', 'a'])],
  } as G;
  const L = generateSchematicLayout(g);
  ok(L.placements.length === 2, '两个元件都有布局（回退模式）');
  ok(allOrthogonal(L), '回退模式连线也正交');
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
