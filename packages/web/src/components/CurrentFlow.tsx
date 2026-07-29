import type { CircuitGraph, SolverResult, PlacedComponent, Wire } from '../types';
import { pinWorld, meterPhysicalEndpoint, physicalWirePath, smoothTrailPath, warpTrail } from '../geometry';
import type { Pt } from '../geometry';

interface Props {
  graph: CircuitGraph;
  solver: SolverResult | null;
  mode: 'physical' | 'schematic';
  componentMap: Map<string, PlacedComponent>;
  schemWirePaths?: Array<{ id: string; d: string }>;
}

/** 根据电流大小计算动画速度（秒），电流越大越快 */
function flowSpeed(I: number, maxI: number): number {
  const ratio = Math.max(0.05, Math.min(1, Math.abs(I) / Math.max(maxI, 0.001)));
  return 1.5 - ratio * 1.2;
}/** 单条动画虚线 */
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
 *
 * 电流方向直接由 MNA 求解的 wireCurrents 给出：
 *   wireCurrents[w.id] > 0 → 电流从 from 流向 to
 *   wireCurrents[w.id] < 0 → 电流从 to 流向 from
 *
 * 不再需要任何启发式推断。
 */
export function CurrentFlow({ graph, solver, mode, componentMap, schemWirePaths }: Props) {
  if (!solver || !solver.ok) return null;
  if (!solver.wireCurrents) return null;

  let maxI = 0;
  for (const r of Object.values(solver.readings)) {
    const i = Math.abs(r.current ?? 0);
    if (i > maxI) maxI = i;
  }
  if (maxI < 0.001) return null;

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
  const flowPaths: Array<{ d: string; speed: number; forward: boolean }> = [];

  for (const w of graph.wires) {
    // 直接从 MNA 求解结果读取导线电流
    const wireI = solver.wireCurrents[w.id];
    if (wireI == null || Math.abs(wireI) < 0.001) continue;

    const fc = componentMap.get(w.from.componentId);
    const tc = componentMap.get(w.to.componentId);
    if (!fc || !tc) continue;

    const aRaw = pinWorld(fc, w.from.pin);
    const bRaw = pinWorld(tc, w.to.pin);
    const a = meterPhysicalEndpoint(fc, w.from.pin) ?? aRaw;
    const b = meterPhysicalEndpoint(tc, w.to.pin) ?? bRaw;

    // 路径
    const hasCP = w.controlPoints && w.controlPoints.length > 0;
    let d: string;
    if (hasCP) {
      d = physicalWirePath(a, b, w.controlPoints as Array<[number, number]>);
    } else if (w.path && w.path.length >= 3) {
      d = smoothTrailPath(warpTrail(w.path as Pt[], a, b));
    } else {
      d = physicalWirePath(a, b);
    }

    // 方向：wireI > 0 → from→to (forward=true); wireI < 0 → to→from (forward=false)
    const forward = wireI > 0;

    const speed = flowSpeed(Math.abs(wireI), maxI);
    flowPaths.push({ d, speed, forward });
  }

  return (
    <g pointerEvents="none">
      {flowPaths.map((p, i) => (
        <FlowPath key={i} d={p.d} speed={p.speed} forward={p.forward} />
      ))}
    </g>
  );
}
