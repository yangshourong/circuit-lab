// Benchmark regression suite: every case has a known analytical solution.
// Run with:  npx tsx tests/benchmarks.test.ts
import { CircuitGraph, PlacedComponent, Wire, solveCircuit } from '../src/index';

let pass = 0;
let fail = 0;
const EPS = 1e-6;

function near(actual: number, expected: number, eps = 1e-3, msg = ''): void {
  if (!isFinite(actual) || Math.abs(actual - expected) > eps) {
    fail++;
    console.error(`  ✗ FAIL ${msg}: expected ${expected}, got ${actual}`);
  } else {
    pass++;
  }
}

function ok(cond: boolean, msg: string): void {
  if (cond) pass++;
  else {
    fail++;
    console.error(`  ✗ FAIL ${msg}`);
  }
}

function C(id: string, type: string, params: Record<string, number | string | boolean> = {}, extra: Partial<PlacedComponent> = {}): PlacedComponent {
  return { id, type, x: 0, y: 0, params, ...extra };
}
function W(id: string, from: [string, string], to: [string, string]): Wire {
  return { id, from: { componentId: from[0], pin: from[1] }, to: { componentId: to[0], pin: to[1] } };
}
function solve(comps: PlacedComponent[], wires: Wire[]) {
  return solveCircuit({ components: comps, wires } as CircuitGraph);
}

console.log('MNA engine benchmark suite\n');

// 1. Series battery (with internal resistance) + resistor
{
  console.log('1. 串联：电源(3V,0.5Ω) + 电阻(5.5Ω)');
  const r = solve([C('B', 'battery', { voltage: 3, internalResistance: 0.5 }), C('R', 'resistor', { resistance: 5.5 })], [W('w1', ['B', 'a'], ['R', 'a']), W('w2', ['R', 'b'], ['B', 'b'])]);
  ok(r.ok, 'solved');
  near(r.readings['R'].current!, 0.5, 1e-3, 'R current');
  near(r.readings['R'].voltage!, 2.75, 1e-3, 'R voltage');
  near(r.readings['B'].current!, 0.5, 1e-3, 'battery current');
  near(r.readings['B'].voltage!, 2.75, 1e-3, 'battery terminal voltage');
}

// 2. Two resistors in series, ideal source
{
  console.log('2. 串联分压：电源(2V) + 2Ω + 2Ω');
  const r = solve([C('B', 'battery', { voltage: 2, internalResistance: 0 }), C('R1', 'resistor', { resistance: 2 }), C('R2', 'resistor', { resistance: 2 })], [W('w1', ['B', 'a'], ['R1', 'a']), W('w2', ['R1', 'b'], ['R2', 'a']), W('w3', ['R2', 'b'], ['B', 'b'])]);
  ok(r.ok, 'solved');
  near(r.readings['R1'].current!, 0.5, 1e-3, 'series current');
  near(r.readings['R1'].voltage!, 1.0, 1e-3, 'R1 voltage');
  near(r.readings['R2'].voltage!, 1.0, 1e-3, 'R2 voltage');
}

// 3. Two resistors in parallel
{
  console.log('3. 并联：电源(2V) + 2Ω ∥ 2Ω');
  const r = solve([C('B', 'battery', { voltage: 2, internalResistance: 0 }), C('R1', 'resistor', { resistance: 2 }), C('R2', 'resistor', { resistance: 2 })], [W('w1', ['B', 'a'], ['R1', 'a']), W('w2', ['B', 'a'], ['R2', 'a']), W('w3', ['R1', 'b'], ['B', 'b']), W('w4', ['R2', 'b'], ['B', 'b'])]);
  ok(r.ok, 'solved');
  near(r.readings['R1'].current!, 1.0, 1e-3, 'R1 current');
  near(r.readings['R2'].current!, 1.0, 1e-3, 'R2 current');
  near(r.readings['R1'].voltage!, 2.0, 1e-3, 'parallel voltage');
}

// 4. Voltage divider ratio
{
  console.log('4. 分压比：6V 经 4Ω/2Ω，取下端电压');
  const r = solve([C('B', 'battery', { voltage: 6, internalResistance: 0 }), C('R1', 'resistor', { resistance: 4 }), C('R2', 'resistor', { resistance: 2 })], [W('w1', ['B', 'a'], ['R1', 'a']), W('w2', ['R1', 'b'], ['R2', 'a']), W('w3', ['R2', 'b'], ['B', 'b'])]);
  ok(r.ok, 'solved');
  near(r.readings['R2'].voltage!, 2.0, 1e-3, 'bottom resistor = 2V');
  near(r.readings['R1'].voltage!, 4.0, 1e-3, 'top resistor = 4V');
}

// 5. Wheatstone bridge, balanced (no galvanometer current)
{
  console.log('5. 惠斯通电桥（平衡）：中点等势，桥电阻无电流');
  const r = solve([
    C('B', 'battery', { voltage: 5, internalResistance: 0 }),
    C('R1', 'resistor', { resistance: 10 }),
    C('R2', 'resistor', { resistance: 10 }),
    C('R3', 'resistor', { resistance: 10 }),
    C('R4', 'resistor', { resistance: 10 }),
    C('Rg', 'resistor', { resistance: 10 }),
  ], [
    W('wa', ['B', 'a'], ['R1', 'a']), W('wb', ['R2', 'b'], ['B', 'b']),
    W('wc', ['B', 'a'], ['R3', 'a']), W('wd', ['R4', 'b'], ['B', 'b']),
    W('we', ['R1', 'b'], ['Rg', 'a']), W('wf', ['R2', 'a'], ['Rg', 'a']),
    W('wg', ['R3', 'b'], ['Rg', 'b']), W('wh', ['R4', 'a'], ['Rg', 'b']),
  ]);
  ok(r.ok, 'solved');
  near(r.readings['Rg'].current!, 0, 1e-4, 'bridge current ≈ 0');
  near(r.readings['R1'].voltage!, r.readings['R2'].voltage!, 1e-3, 'midpoints equal potential');
}

// 6. Ammeter measures series current
{
  console.log('6. 电流表串入回路：测 3V/3Ω = 1A');
  const r = solve([C('B', 'battery', { voltage: 3, internalResistance: 0 }), C('A', 'ammeter'), C('R', 'resistor', { resistance: 3 })], [W('w1', ['B', 'a'], ['A', 'a']), W('w2', ['A', 'b'], ['R', 'a']), W('w3', ['R', 'b'], ['B', 'b'])]);
  ok(r.ok, 'solved');
  near(r.readings['A'].measured!, 1.0, 1e-3, 'ammeter = 1A');
}

// 7. Voltmeter reads resistor voltage, negligible current draw
{
  console.log('7. 电压表跨接 2Ω 下端：读数 2V，自身电流≈0');
  const r = solve([C('B', 'battery', { voltage: 6, internalResistance: 0 }), C('R1', 'resistor', { resistance: 4 }), C('R2', 'resistor', { resistance: 2 }), C('V', 'voltmeter')], [W('w1', ['B', 'a'], ['R1', 'a']), W('w2', ['R1', 'b'], ['R2', 'a']), W('w3', ['R2', 'b'], ['B', 'b']), W('w4', ['V', 'a'], ['R2', 'a']), W('w5', ['V', 'b'], ['R2', 'b'])]);
  ok(r.ok, 'solved');
  near(r.readings['V'].measured!, 2.0, 1e-3, 'voltmeter = 2V');
  ok(Math.abs(r.readings['V'].current! ) < 1e-3, 'voltmeter current negligible');
}

// 8. Lamp short fault → bypass, large battery current
{
  console.log('8. 电灯短路：电流绕过敏感元件，电池电流 = E/r');
  const normal = solve([C('B', 'battery', { voltage: 3, internalResistance: 0.5 }), C('L', 'lamp', { ratedVoltage: 2.5, ratedPower: 0.5 })], [W('w1', ['B', 'a'], ['L', 'a']), W('w2', ['L', 'b'], ['B', 'b'])]);
  near(normal.readings['L'].current!, 3 / 13, 1e-3, 'normal lamp current = 3/13 A');
  const shorted = solve([C('B', 'battery', { voltage: 3, internalResistance: 0.5 }), C('L', 'lamp', { ratedVoltage: 2.5, ratedPower: 0.5 }, { fault: 'short' })], [W('w1', ['B', 'a'], ['L', 'a']), W('w2', ['L', 'b'], ['B', 'b'])]);
  ok(shorted.ok, 'shorted solves');
  near(shorted.readings['B'].current!, 6.0, 1e-2, 'shorted battery current = 6A');
  ok(!('L' in shorted.readings), 'shorted lamp produces no reading (bypassed)');
}

// 9. Lamp open fault → no closed loop
{
  console.log('9. 电灯断路：回路断开，电池电流 = 0');
  const open = solve([C('B', 'battery', { voltage: 3, internalResistance: 0.5 }), C('L', 'lamp', { ratedVoltage: 2.5, ratedPower: 0.5 }, { fault: 'open' })], [W('w1', ['B', 'a'], ['L', 'a']), W('w2', ['L', 'b'], ['B', 'b'])]);
  ok(open.ok, 'open solves (no crash)');
  near(open.readings['B'].current!, 0, 1e-6, 'open battery current = 0');
}

// 10. Internal resistance drops terminal voltage under load
{
  console.log('10. 内阻效应：3V 带 5Ω 负载，r=0→3V，r=1→2.5V');
  const r0 = solve([C('B', 'battery', { voltage: 3, internalResistance: 0 }), C('R', 'resistor', { resistance: 5 })], [W('w1', ['B', 'a'], ['R', 'a']), W('w2', ['R', 'b'], ['B', 'b'])]);
  const r1 = solve([C('B', 'battery', { voltage: 3, internalResistance: 1 }), C('R', 'resistor', { resistance: 5 })], [W('w1', ['B', 'a'], ['R', 'a']), W('w2', ['R', 'b'], ['B', 'b'])]);
  near(r0.readings['R'].voltage!, 3.0, 1e-3, 'r=0 terminal voltage = 3V');
  near(r1.readings['R'].voltage!, 2.5, 1e-3, 'r=1 terminal voltage = 2.5V');
}

// 11. Contradictory ideal voltage sources in parallel → graceful error
{
  console.log('11. 理想电压源直接并联：应优雅报错而非崩溃');
  const bad = solve([C('B1', 'battery', { voltage: 3, internalResistance: 0 }), C('B2', 'battery', { voltage: 3, internalResistance: 0 }), C('R', 'resistor', { resistance: 5 })], [W('w1', ['B1', 'a'], ['R', 'a']), W('w2', ['R', 'b'], ['B1', 'b']), W('w3', ['B2', 'a'], ['R', 'a']), W('w4', ['R', 'b'], ['B2', 'b'])]);
  ok(!bad.ok, 'reports unsolvable (graceful)');
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
