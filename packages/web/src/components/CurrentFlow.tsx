import type { CircuitGraph, SolverResult, PlacedComponent, Wire } from '../types';
import { pinWorld, meterPhysicalEndpoint, physicalWirePath, smoothTrailPath, warpTrail } from '../geometry';
import type { Pt } from '../geometry';
import { getComponentDef } from '@circuit/core';

interface Props {
  graph: CircuitGraph;
  solver: SolverResult | null;
  mode: 'physical' | 'schematic';
  componentMap: Map<string, PlacedComponent>;
  schemWirePaths?: Array<{ id: string; d: string }>;
}

/** 判断电流在元件引脚上是流入还是流出 */
function flowAtPin(
  compId: string, compType: string, pin: string,
  pinVoltages: Map<string, Record<string, number>>, solver: SolverResult,
): 'enter' | 'exit' | null {
  const pv = pinVoltages.get(compId);
  if (!pv) return null;
  const va = pv['a'], vb = pv['b'];
  if (va == null || vb == null) return null;
  const diff = va - vb;
  const isSource = getComponentDef(compType)?.category === 'source';
  if (Math.abs(diff) < 1e-8) {
    const cur = solver.readings[compId]?.current;
    if (cur == null || Math.abs(cur) < 1e-8) return null;
    if (pin === 'a') return isSource ? (cur > 0 ? 'exit' : 'enter') : (cur > 0 ? 'enter' : 'exit');
    if (pin === 'b') return isSource ? (cur > 0 ? 'enter' : 'exit') : (cur > 0 ? 'exit' : 'enter');
    return null;
  }
  if (pin === 'a') return isSource ? (diff > 0 ? 'exit' : 'enter') : (diff > 0 ? 'enter' : 'exit');
  if (pin === 'b') return isSource ? (diff > 0 ? 'enter' : 'exit') : (diff > 0 ? 'exit' : 'enter');
  return null;
}

/** 通过导线拓扑追溯，找最近的 active 元件推断电流方向 */
function inferDirectionFromNeighbors(
  wire: Wire, graph: CircuitGraph, solver: SolverResult,
  componentMap: Map<string, PlacedComponent>,
  pinVoltages: Map<string, Record<string, number>>,
): boolean {
  const findActive = (startId: string, startPin: string): 'enter' | 'exit' | null => {
    const visited = new Set<string>();
    const queue: Array<{ compId: string; pin: string }> = [{ compId: startId, pin: startPin }];
    while (queue.length > 0) {
      const { compId, pin } = queue.shift()!;
      const key = `${compId}:${pin}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const cur = solver.readings[compId]?.current;
      if (cur != null && Math.abs(cur) > 0.0001) {
        const ff = flowAtPin(compId, componentMap.get(compId)?.type ?? '', pin, pinVoltages, solver);
        if (ff) return ff;
      }
      for (const w of graph.wires) {
        if (w.from.componentId === compId && w.from.pin === pin) queue.push({ compId: w.to.componentId, pin: w.to.pin });
        if (w.to.componentId === compId && w.to.pin === pin) queue.push({ compId: w.from.componentId, pin: w.from.pin });
      }
    }
    return null;
  };

  const src = findActive(wire.from.componentId, wire.from.pin);
  const dst = findActive(wire.to.componentId, wire.to.pin);

  if (src === 'exit') return true;
  if (dst === 'enter') return true;
  if (src === 'enter') return false;
  if (dst === 'exit') return false;
  return true;
}

/** 根据电流大小计算动画速度（秒），电流越大越快 */
function flowSpeed(I: number, maxI: number): number {
  const ratio = Math.max(0.05, Math.min(1, Math.abs(I) / Math.max(maxI, 0.001)));
  return 1.5 - ratio * 1.2;
}

/** 单条动画虚线 */
function FlowPath({ d, speed, forward }: { d: string; speed: number; forward: boolean }) {
  return (
    <path d={d} fill="none" stroke="#22d3ee" strokeWidth={2}
      strokeLinecap="round" strokeDasharray="3 12" className="current-flow"
      style={{ animationDuration: `${speed}s`, animationDirection: forward ? 'normal' : 'reverse' }}
    />
  );
}

/**
 * 导线电流流动粒子效果。
 * 根据真实物理原理（电流从高电位流向低电位）计算方向。
 */
export function CurrentFlow({ graph, solver, mode, componentMap, schemWirePaths }: Props) {
  if (!solver || !solver.ok) return null;

  let maxI = 0;
  for (const r of Object.values(solver.readings)) {
    const i = Math.abs(r.current ?? 0);
    if (i > maxI) maxI = i;
  }
  if (maxI < 0.001) return null;

  // 构建 pinVoltages 查表
  const pinVoltages = new Map<string, Record<string, number>>();
  for (const [id, r] of Object.entries(solver.readings)) {
    if (r.pinVoltages) pinVoltages.set(id, r.pinVoltages);
  }

  if (mode === 'schematic' && schemWirePaths) {
    return (
      <g pointerEvents="none">
        {schemWirePaths.map((sw) => (
          <FlowPath key={sw.id} d={sw.d} speed={flowSpeed(1, maxI)} forward={true} />
        ))}
      </g>
    );
  }

  // Physical mode
  const paths: Array<{ d: string; speed: number; forward: boolean }> = [];
  for (const w of graph.wires) {
    const fc = componentMap.get(w.from.componentId);
    const tc = componentMap.get(w.to.componentId);
    if (!fc || !tc) continue;

    const aRaw = pinWorld(fc, w.from.pin);
    const bRaw = pinWorld(tc, w.to.pin);
    // 仪表端点调整到底部接线柱位置
    const a = meterPhysicalEndpoint(fc, w.from.pin) ?? aRaw;
    const b = meterPhysicalEndpoint(tc, w.to.pin) ?? bRaw;

    // 估算电流
    const iFrom = solver.readings[w.from.componentId]?.current;
    const iTo = solver.readings[w.to.componentId]?.current;
    const iFromAbs = iFrom === undefined ? null : Math.abs(iFrom);
    const iToAbs = iTo === undefined ? null : Math.abs(iTo);
    const bothNull = iFromAbs === null && iToAbs === null;
    const samePolarity = w.from.pin === w.to.pin;

    // 方向判断
    const fFlow = flowAtPin(w.from.componentId, fc.type, w.from.pin, pinVoltages, solver);
    const tFlow = flowAtPin(w.to.componentId, tc.type, w.to.pin, pinVoltages, solver);

    let forward: boolean;
    if (samePolarity && iFrom != null && iTo != null && Math.abs(Math.abs(iFrom) - Math.abs(iTo)) > 0.0001) {
      forward = Math.abs(iFrom) >= Math.abs(iTo);
    } else if (fFlow === 'exit') forward = true;
    else if (fFlow === 'enter') forward = false;
    else if (tFlow === 'enter') forward = true;
    else if (tFlow === 'exit') forward = false;
    else if (bothNull) {
      forward = inferDirectionFromNeighbors(w, graph, solver, componentMap, pinVoltages);
    } else forward = true;

    // 路径 — controlPoints stores only interior mid-points
    let d: string;
    const hasCP = w.controlPoints && w.controlPoints.length > 0;
    if (hasCP) {
      d = physicalWirePath(a, b, w.controlPoints as Array<[number, number]>);
    } else if (w.path && w.path.length >= 3) {
      d = smoothTrailPath(warpTrail(w.path as Pt[], a, b));
    } else {
      d = physicalWirePath(a, b);
    }

    // 电流阈值
    if (iFromAbs !== null && iFromAbs < 0.0001) continue;
    if (iToAbs !== null && iToAbs < 0.0001) continue;
    const wireI = bothNull ? maxI : Math.max(iFromAbs ?? 0, iToAbs ?? 0);
    if (wireI < 0.001) continue;

    paths.push({ d, speed: flowSpeed(wireI, maxI), forward });
  }

  return (
    <g pointerEvents="none">
      {paths.map((p, i) => (
        <FlowPath key={i} d={p.d} speed={p.speed} forward={p.forward} />
      ))}
    </g>
  );
}
