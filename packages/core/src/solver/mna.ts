import {
  CircuitGraph,
  ComponentDef,
  ComponentReading,
  PlacedComponent,
  PinId,
  SolverResult,
  StampBuilder,
} from '../types';
import { getComponentDef } from '../components/registry';
import { solveLinear } from './matrix';

const PIN_SEP = '::';

class StampBuilderImpl implements StampBuilder {
  G: number[][];
  bvec: number[];
  nNodes: number;
  nBranches = 0;
  /** Element edges (a,b) recorded during stamping, used for connectivity. */
  edges: Array<[number, number]> = [];
  solution: number[] | null = null;
  measures: ((b: StampBuilderImpl) => void)[] = [];
  comp!: PlacedComponent;
  def!: ComponentDef;
  pinNodes: Map<PinId, number> = new Map();
  reading: Record<string, unknown> = {};

  constructor(nNodes: number) {
    this.nNodes = nNodes;
    this.G = Array.from({ length: nNodes }, () => new Array<number>(nNodes).fill(0));
    this.bvec = new Array<number>(nNodes).fill(0);
  }

  private ensure(): void {
    const total = this.nNodes + this.nBranches;
    while (this.G.length < total) {
      this.G.push(new Array<number>(total).fill(0));
      this.bvec.push(0);
    }
    for (const row of this.G) {
      while (row.length < total) row.push(0);
    }
  }

  node(pin: PinId): number {
    return this.pinNodes.get(pin) ?? -1;
  }

  addBranch(): number {
    const k = this.nBranches++;
    this.ensure();
    return k;
  }

  addNode(): number {
    const n = this.nNodes++;
    this.ensure();
    return n;
  }

  conductance(a: number, b: number, g: number): void {
    if (a < 0 || b < 0) return;
    this.edges.push([a, b]);
    this.G[a][a] += g;
    this.G[a][b] -= g;
    this.G[b][a] -= g;
    this.G[b][b] += g;
  }

  voltageSource(a: number, b: number, emf: number, k: number): void {
    const row = this.nNodes + k;
    if (a >= 0) {
      this.G[a][row] += 1;
      this.G[row][a] += 1;
    }
    if (b >= 0) {
      this.G[b][row] -= 1;
      this.G[row][b] -= 1;
    }
    if (a >= 0 && b >= 0) this.edges.push([a, b]);
    this.bvec[row] = emf;
  }

  currentSource(a: number, b: number, i: number): void {
    if (a >= 0) this.bvec[a] -= i;
    if (b >= 0) this.bvec[b] += i;
  }

  measure(fn: (b: StampBuilderImpl) => void): void {
    this.measures.push(fn);
  }

  V(pin: PinId): number {
    const n = this.pinNodes.get(pin);
    if (n === undefined || n < 0 || !this.solution) return 0;
    return this.solution[n];
  }

  I(k: number): number {
    if (!this.solution) return 0;
    return this.solution[this.nNodes + k];
  }

  param(key: string): number {
    const v = this.comp.params[key];
    if (typeof v === 'number') return v;
    const d = this.def.defaults[key];
    return typeof d === 'number' ? d : 0;
  }
}

/**
 * Solve a DC steady-state circuit using Modified Nodal Analysis.
 *
 * Strategy:
 *  - Merge equipotential pins (wires, closed switches, shorted elements) via union-find.
 *  - Index electrical nodes; allocate branch-current unknowns for voltage sources / ammeters.
 *  - Stamp each component; solve the resulting linear system.
 *  - Run per-component measurement closures to produce human-readable readings.
 */
export function solveCircuit(graph: CircuitGraph): SolverResult {
  // ---- 1. Union-find over pins (equipotential merging) ----
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let cur = x;
    while (parent.get(cur) !== cur) {
      const nxt = parent.get(cur)!;
      parent.set(cur, parent.get(nxt)!);
      cur = nxt;
    }
    return cur;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const ensure = (k: string): void => {
    if (!parent.has(k)) parent.set(k, k);
  };

  for (const comp of graph.components) {
    const def = getComponentDef(comp.type);
    if (!def) continue;
    for (const p of def.pins) ensure(`${comp.id}${PIN_SEP}${p.id}`);
  }

  for (const w of graph.wires ?? []) {
    union(`${w.from.componentId}${PIN_SEP}${w.from.pin}`, `${w.to.componentId}${PIN_SEP}${w.to.pin}`);
  }

  for (const comp of graph.components) {
    const def = getComponentDef(comp.type);
    if (!def) continue;
    if (def.equipotential) {
      for (const [a, b] of def.equipotential(comp)) {
        const ra = comp.flipPolarity && a === 'a' ? 'b' : comp.flipPolarity && a === 'b' ? 'a' : a;
        const rb = comp.flipPolarity && b === 'a' ? 'b' : comp.flipPolarity && b === 'b' ? 'a' : b;
        union(`${comp.id}${PIN_SEP}${ra}`, `${comp.id}${PIN_SEP}${rb}`);
      }
    }
    if (def.faultable && comp.fault === 'short' && def.mainPins) {
      const mp0 = comp.flipPolarity && def.mainPins[0] === 'a' ? 'b' : comp.flipPolarity && def.mainPins[0] === 'b' ? 'a' : def.mainPins[0];
      const mp1 = comp.flipPolarity && def.mainPins[1] === 'a' ? 'b' : comp.flipPolarity && def.mainPins[1] === 'b' ? 'a' : def.mainPins[1];
      union(`${comp.id}${PIN_SEP}${mp0}`, `${comp.id}${PIN_SEP}${mp1}`);
    }
  }

  // ---- 2. Map pin roots -> node indices ----
  const rootToNode = new Map<string, number>();
  const pinToNode: Record<string, number> = {};
  for (const comp of graph.components) {
    const def = getComponentDef(comp.type);
    if (!def) continue;
    for (const p of def.pins) {
      const key = `${comp.id}${PIN_SEP}${p.id}`;
      const root = find(key);
      if (!rootToNode.has(root)) rootToNode.set(root, rootToNode.size);
      pinToNode[key] = rootToNode.get(root)!;
    }
  }
  const nNodes = rootToNode.size;

  // ---- 3. Connected components over nodes (element-based) for grounding ----
  const nParent = new Map<number, number>();
  for (let i = 0; i < nNodes; i++) nParent.set(i, i);
  const nfind = (x: number): number => {
    let cur = x;
    while (nParent.get(cur) !== cur) {
      const nxt = nParent.get(cur)!;
      nParent.set(cur, nParent.get(nxt)!);
      cur = nxt;
    }
    return cur;
  };
  const nunion = (a: number, b: number): void => {
    const ra = nfind(a);
    const rb = nfind(b);
    if (ra !== rb) nParent.set(ra, rb);
  };

  // ---- 4. Stamp components that have electrical behavior ----
  const stampComps: { comp: PlacedComponent; def: ComponentDef }[] = [];
  for (const comp of graph.components) {
    const def = getComponentDef(comp.type);
    if (!def || def.passive || !def.stamp) continue;
    if (def.faultable && (comp.fault === 'open' || comp.fault === 'short')) continue;
    stampComps.push({ comp, def });
  }

  const builder = new StampBuilderImpl(nNodes);
  const compMeasures = new Map<string, ((b: StampBuilderImpl) => void)[]>();
  const compPinNodes = new Map<string, Map<PinId, number>>();

  for (const { comp, def } of stampComps) {
    const pm = new Map<PinId, number>();
    for (const p of def.pins) {
      const pid = p.id;
      // flipPolarity: 交换 a↔b 引脚节点
      const resolvedId = comp.flipPolarity && pid === 'a' ? 'b' : comp.flipPolarity && pid === 'b' ? 'a' : pid;
      pm.set(pid, pinToNode[`${comp.id}${PIN_SEP}${resolvedId}`]);
    }
    compPinNodes.set(comp.id, pm);

    builder.comp = comp;
    builder.def = def;
    builder.pinNodes = pm;
    builder.measures = [];
    def.stamp!(builder, comp, def);
    compMeasures.set(comp.id, builder.measures);
  }

  // ---- 5. Connectivity over ALL nodes (incl. internal) from stamped edges ----
  const totalNodes = builder.nNodes;
  for (let i = 0; i < totalNodes; i++) if (!nParent.has(i)) nParent.set(i, i);
  for (const [a, b] of builder.edges) nunion(a, b);

  // ---- 6. Ground exactly one node per connected component ----
  const grounded = new Set<number>();
  const grounds: number[] = [];
  for (let i = 0; i < totalNodes; i++) {
    const r = nfind(i);
    if (!grounded.has(r)) {
      grounded.add(r);
      grounds.push(i);
    }
  }
  for (const g of grounds) {
    const total = builder.G.length;
    for (let j = 0; j < total; j++) {
      builder.G[g][j] = 0;
      builder.G[j][g] = 0;
    }
    builder.G[g][g] = 1;
    builder.bvec[g] = 0;
  }

  // ---- 6. Solve ----
  const size = builder.G.length;
  const A = builder.G.map((row) => row.slice(0, size));
  const x = solveLinear(A, builder.bvec.slice(0, size));
  if (!x) {
    return {
      ok: false,
      error: '电路存在矛盾或无法求解（例如理想电压源直接并联，或存在悬空回路）。请检查接线。',
      nodeCount: nNodes,
      branchCount: builder.nBranches,
      readings: {},
    };
  }
  builder.solution = x;

  // ---- 7. Measurements ----
  const readings: Record<string, ComponentReading> = {};
  for (const { comp, def } of stampComps) {
    builder.comp = comp;
    builder.def = def;
    builder.pinNodes = compPinNodes.get(comp.id)!;
    builder.reading = {};
    for (const m of compMeasures.get(comp.id) ?? []) m(builder);
    readings[comp.id] = { ...(builder.reading as ComponentReading) };
  }

  return {
    ok: true,
    nodeCount: nNodes,
    branchCount: builder.nBranches,
    readings,
    solution: x,
    nodeVoltages: x.slice(0, nNodes),
  };
}
