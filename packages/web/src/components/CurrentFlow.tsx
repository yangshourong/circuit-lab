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

/**
 * 获取某个元件引脚的节点电压。
 * 直接从 solver.readings 中取 pinVoltages，无则返回 null。
 */
function pinVoltage(
  compId: string, pin: string,
  solver: SolverResult,
): number | null {
  const reading = solver.readings[compId];
  if (!reading?.pinVoltages) return null;
  const v = reading.pinVoltages[pin];
  return v != null ? v : null;
}

/**
 * 判断导线上电流的实际方向。
 *
 * 物理原理：导线连接两个等电位节点（被 solver 合并），但导线两端的
 * 元件引脚属于各自的元件，其 pinVoltages 反映的是元件引脚上的节点电压。
 * 电流从高电位流向低电位。
 *
 * @returns true = 电流从 from 流向 to；false = 电流从 to 流向 from
 */
function wireCurrentDirection(
  w: Wire,
  solver: SolverResult,
  componentMap: Map<string, PlacedComponent>,
): boolean | null {
  const vFrom = pinVoltage(w.from.componentId, w.from.pin, solver);
  const vTo = pinVoltage(w.to.componentId, w.to.pin, solver);

  if (vFrom == null || vTo == null) return null;

  const diff = vFrom - vTo;

  // 两端等电位（正常——导线两端实际上连的是同一个节点）
  // 此时需要通过元件侧的信息推断电流流向
  if (Math.abs(diff) < 1e-6) {
    return inferFromComponentCurrent(w, solver, componentMap);
  }

  // 电流从高电位流向低电位
  return diff > 0; // true = from→to
}

/**
 * 当导线两端等电位时，通过导线连接的元件电流推断流向。
 * 查看两端元件的电流：如果 from 侧元件在该引脚是"流出"电流，
 * 则电流从 from 流向 to。
 */
function inferFromComponentCurrent(
  w: Wire,
  solver: SolverResult,
  componentMap: Map<string, PlacedComponent>,
): boolean | null {
  const fromReading = solver.readings[w.from.componentId];
  const toReading = solver.readings[w.to.componentId];
  if (!fromReading || !toReading) return null;

  const fromCurrent = fromReading.current;
  const toCurrent = toReading.current;

  if (fromCurrent == null && toCurrent == null) return null;

  // 判断 from 侧元件在 from.pin 上是流出还是流入电流
  const fromFlow = currentFlowAtPin(w.from.componentId, w.from.pin, solver, componentMap);
  const toFlow = currentFlowAtPin(w.to.componentId, w.to.pin, solver, componentMap);

  // from 侧引脚流出 → 电流 from→to (true)
  // to 侧引脚流入 → 电流 from→to (true)
  if (fromFlow === 'exit') return true;
  if (fromFlow === 'enter') return false;
  if (toFlow === 'enter') return true;
  if (toFlow === 'exit') return false;

  return null;
}

/**
 * 判断电流在元件的某个引脚上是流入还是流出。
 *
 * 统一约定（基于 MNA 求解器的电流方向）：
 *   - battery (source): current > 0 表示电源向外供电 → a 端流出、b 端流入
 *   - 所有其他元件 (load/meter/control): current > 0 表示电流从 a 端流入、b 端流出
 *
 * 因此：
 *   current > 0 时：
 *     battery: pin 'a' → exit, pin 'b' → enter
 *     others:  pin 'a' → enter, pin 'b' → exit
 *   current < 0 时：
 *     battery: pin 'a' → enter, pin 'b' → exit
 *     others:  pin 'a' → exit, pin 'b' → enter
 */
function currentFlowAtPin(
  compId: string,
  pin: string,
  solver: SolverResult,
  componentMap: Map<string, PlacedComponent>,
): 'enter' | 'exit' | null {
  const reading = solver.readings[compId];
  if (!reading) return null;
  const current = reading.current;
  if (current == null || Math.abs(current) < 1e-8) return null;

  const comp = componentMap.get(compId);
  if (!comp) return null;

  // 查元件分类，只 battery 是 source
  const def = getComponentDef(comp.type);
  const isBattery = def?.type === 'battery';

  // current > 0 的方向约定
  const positiveA = isBattery ? 'exit' : 'enter';  // a 端在 current>0 时的流向
  const positiveB = isBattery ? 'enter' : 'exit';  // b 端在 current>0 时的流向

  const flow = current > 0
    ? (pin === 'a' ? positiveA : pin === 'b' ? positiveB : null)
    : (pin === 'a' ? (positiveA === 'enter' ? 'exit' : 'enter')
                   : pin === 'b' ? (positiveB === 'enter' ? 'exit' : 'enter') : null);

  return flow;
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

    // 方向判断：电流从高电位流向低电位
    const forward = wireCurrentDirection(w, solver, componentMap);

    // 电流大小估算
    const iFrom = solver.readings[w.from.componentId]?.current;
    const iTo = solver.readings[w.to.componentId]?.current;
    const iFromAbs = iFrom != null ? Math.abs(iFrom) : null;
    const iToAbs = iTo != null ? Math.abs(iTo) : null;
    const bothNull = iFromAbs === null && iToAbs === null;
    if (iFromAbs !== null && iFromAbs < 0.0001) continue;
    if (iToAbs !== null && iToAbs < 0.0001) continue;
    const wireI = bothNull ? maxI : Math.max(iFromAbs ?? 0, iToAbs ?? 0);
    if (wireI < 0.001) continue;

    // forward === null 表示方向无法确定，跳过该导线的动画
    if (forward === null) continue;

    // forward=true → 动画从 from→to（SVG path 方向）
    // forward=false → 动画反向（to→from）
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
