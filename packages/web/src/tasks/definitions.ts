import type { CircuitGraph, SolverResult } from '../types';

export interface TaskResult {
  passed: boolean;
  detail: string;
}

export interface TaskDef {
  id: string;
  title: string;
  goal: string;
  hint: string;
  /** Pure predicate over the current graph + solver result. */
  check: (graph: CircuitGraph, solver: SolverResult | null) => TaskResult;
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const TASKS: TaskDef[] = [
  {
    id: 'ohm',
    title: '探究欧姆定律',
    goal: '搭建由电源、定值电阻、电流表、电压表组成的串联电路，验证 I = U / R（即 U = I·R）。',
    hint: '将电流表串联在电阻支路中，电压表并联在电阻两端；改变电源电动势或电阻阻值，观察读数是否满足 U = I·R。',
    check: (graph, solver) => {
      if (!solver || !solver.ok) return { passed: false, detail: '电路尚未形成有效回路（求解失败）。' };
      const res = graph.components.find((c) => c.type === 'resistor');
      if (!res) return { passed: false, detail: '请放置一个定值电阻。' };
      const r = solver.readings[res.id];
      if (!r || r.voltage == null || r.current == null) {
        return { passed: false, detail: '电阻两端无电压或电流，请检查接线与开关。' };
      }
      const R = num(res.params.resistance, 10);
      const expected = r.current * R;
      const diff = Math.abs(r.voltage - expected);
      const ok = diff / (Math.abs(r.voltage) + 1e-6) < 0.05;
      return {
        passed: ok,
        detail: `测得 U=${r.voltage.toFixed(2)}V，I=${r.current.toFixed(3)}A，计算 U'=I·R=${expected.toFixed(2)}V（R=${R}Ω）。`,
      };
    },
  },
  {
    id: 'lamp-power',
    title: '测量小灯泡的电功率',
    goal: '将小灯泡调到额定电压，记录其实测功率 P = U·I，并与额定功率比较。',
    hint: '用电压表测量灯泡两端电压 U、电流表测量电流 I；调节滑动变阻器使 U 达到灯泡额定电压（默认 2.5V）。',
    check: (graph, solver) => {
      if (!solver || !solver.ok) return { passed: false, detail: '电路尚未形成有效回路。' };
      const lamp = graph.components.find((c) => c.type === 'lamp');
      if (!lamp) return { passed: false, detail: '请放置一个小灯泡。' };
      const r = solver.readings[lamp.id];
      if (!r) return { passed: false, detail: '灯泡未接入回路。' };
      const Vr = num(lamp.params.ratedVoltage, 2.5);
      const Pr = num(lamp.params.ratedPower, 0.5);
      const U = r.voltage ?? 0;
      const I = r.current ?? 0;
      const P = U * I;
      const ok = Math.abs(U - Vr) / (Vr + 1e-6) < 0.05;
      return {
        passed: ok,
        detail: `U=${U.toFixed(2)}V（额定 ${Vr}V），I=${I.toFixed(3)}A，P=U·I=${P.toFixed(3)}W（额定 ${Pr}W）。`,
      };
    },
  },
  {
    id: 'series-divider',
    title: '探究串联分压规律',
    goal: '两个定值电阻串联，验证分压比等于电阻比：U₁ / U₂ = R₁ / R₂。',
    hint: '将两电阻首尾相接串联，分别用电压表测各自两端电压；改变两电阻阻值，观察 U₁/U₂ 是否等于 R₁/R₂。',
    check: (graph, solver) => {
      if (!solver || !solver.ok) return { passed: false, detail: '电路尚未形成有效回路。' };
      const res = graph.components.filter((c) => c.type === 'resistor');
      if (res.length < 2) return { passed: false, detail: `仅找到 ${res.length} 个电阻，请串联两个定值电阻。` };
      const [r1, r2] = res;
      const a = solver.readings[r1.id];
      const b = solver.readings[r2.id];
      if (!a || !b) return { passed: false, detail: '电阻未接入回路。' };
      const U1 = a.voltage ?? 0;
      const U2 = b.voltage ?? 0;
      if (Math.abs(U2) < 1e-9) return { passed: false, detail: '第二个电阻两端电压为 0。' };
      const R1 = num(r1.params.resistance, 10);
      const R2 = num(r2.params.resistance, 10);
      const ratioExp = R1 / R2;
      const ratioMeas = U1 / U2;
      const ok = Math.abs(ratioExp - ratioMeas) / (Math.abs(ratioMeas) + 1e-6) < 0.05;
      return {
        passed: ok,
        detail: `U₁/U₂=${ratioMeas.toFixed(2)}，R₁/R₂=${ratioExp.toFixed(2)}（R₁=${R1}Ω，R₂=${R2}Ω）。`,
      };
    },
  },
];
