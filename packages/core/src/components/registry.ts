import { ComponentDef, PlacedComponent } from '../types';

/** Resistance a lamp presents, derived from its rated voltage / power. */
function lampResistance(comp: PlacedComponent, def: ComponentDef): number {
  const Vr = Math.max(Number(comp.params.ratedVoltage ?? def.defaults.ratedVoltage ?? 2.5), 1e-9);
  const Pr = Number(comp.params.ratedPower ?? def.defaults.ratedPower ?? 0.5);
  if (Pr <= 0) return 1e9;
  return (Vr * Vr) / Pr;
}

const TWO_PIN: { id: 'a' | 'b'; x: number; y: number; label?: string }[] = [
  { id: 'a', x: -45, y: 0, label: '+' },
  { id: 'b', x: 45, y: 0, label: '−' },
];

export const REGISTRY: ComponentDef[] = [
  // 1. 电源 (battery / DC source with internal resistance)
  {
    type: 'battery',
    name: '电源',
    category: 'source',
    pins: TWO_PIN,
    params: [
      { key: 'voltage', label: '电动势', type: 'number', unit: 'V', min: 0, max: 100, step: 0.1, default: 3 },
      { key: 'internalResistance', label: '内阻', type: 'number', unit: 'Ω', min: 0, max: 100, step: 0.1, default: 0 },
    ],
    defaults: { voltage: 3, internalResistance: 0 },
    mainPins: ['a', 'b'],
    stamp(b, comp) {
      const a = b.node('a');
      const bb = b.node('b');
      const E = b.param('voltage');
      const r = b.param('internalResistance');
      const m = b.addNode();
      const k = b.addBranch();
      b.voltageSource(a, m, E, k);
      b.conductance(m, bb, 1 / Math.max(r, 1e-9));
      b.measure(() => {
        // I[k] is current INTO the + terminal; delivered current = -I[k].
        const I = -b.I(k);
        b.reading = {
          current: I,
          voltage: b.V('a') - b.V('b'),
          power: E * I,
          pinVoltages: { a: b.V('a'), b: b.V('b') },
        };
      });
    },
  },

  // 2. 开关 (switch)
  {
    type: 'switch',
    name: '开关',
    category: 'control',
    pins: TWO_PIN,
    params: [{ key: 'closed', label: '闭合', type: 'boolean', default: true }],
    defaults: { closed: true },
    equipotential: (comp) => (comp.closed === false ? [] : [['a', 'b']]),
  },

  // 2b. 多向开关 (multi-position selector, up to 4 positions)
  {
    type: 'multiSwitch',
    name: '多向开关',
    category: 'control',
    pins: [
      { id: 'a', x: -55, y: 0, label: '共' },
      { id: 'b', x: 55, y: -27, label: '1' },
      { id: 'c', x: 55, y: -9, label: '2' },
      { id: 'd', x: 55, y: 9, label: '3' },
      { id: 'e', x: 55, y: 27, label: '4' },
    ],
    params: [
      { key: 'position', label: '档位', type: 'select', default: '1',
        options: [
          { value: '0', label: '断开' },
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
        ],
      },
    ],
    defaults: { position: '1' },
    mainPins: ['a', 'b'],
    equipotential: (comp) => {
      const pos = Number(comp.params.position ?? 1);
      if (pos === 0) return []; // 断开：无连接
      const targets = ['b', 'c', 'd', 'e'];
      return [['a', targets[Math.min(pos - 1, 3)]]];
    },
  },

  // 3. 电灯 (lamp)
  {
    type: 'lamp',
    name: '电灯',
    category: 'load',
    pins: TWO_PIN,
    faultable: true,
    params: [
      { key: 'ratedVoltage', label: '额定电压', type: 'number', unit: 'V', min: 0.1, max: 36, step: 0.1, default: 2.5 },
      { key: 'ratedPower', label: '额定功率', type: 'number', unit: 'W', min: 0.05, max: 100, step: 0.05, default: 0.5 },
    ],
    defaults: { ratedVoltage: 2.5, ratedPower: 0.5 },
    mainPins: ['a', 'b'],
    stamp(b, comp, def) {
      const a = b.node('a');
      const bb = b.node('b');
      const R = lampResistance(comp, def);
      b.conductance(a, bb, 1 / R);
      b.measure(() => {
        const v = b.V('a') - b.V('b');
        const i = v / R;
        b.reading = { voltage: v, current: i, power: v * i, pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 4. 定值电阻 (fixed resistor)
  {
    type: 'resistor',
    name: '定值电阻',
    category: 'load',
    pins: TWO_PIN,
    faultable: true,
    params: [{ key: 'resistance', label: '阻值', type: 'number', unit: 'Ω', min: 0, max: 1e6, step: 1, default: 10, hideable: true }],
    defaults: { resistance: 10 },
    mainPins: ['a', 'b'],
    stamp(b, comp) {
      const a = b.node('a');
      const bb = b.node('b');
      const R = Math.max(b.param('resistance'), 1e-9);
      b.conductance(a, bb, 1 / R);
      b.measure(() => {
        const v = b.V('a') - b.V('b');
        const i = v / R;
        b.reading = { voltage: v, current: i, power: v * i, pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 5. 滑动变阻器 (sliding rheostat, modeled as 2-terminal adjustable resistor for P0)
  {
    type: 'rheostat',
    name: '滑动变阻器',
    category: 'load',
    pins: TWO_PIN,
    params: [{ key: 'resistance', label: '接入阻值', type: 'number', unit: 'Ω', min: 0, max: 100, step: 1, default: 10 }],
    defaults: { resistance: 10 },
    mainPins: ['a', 'b'],
    stamp(b, comp) {
      const a = b.node('a');
      const bb = b.node('b');
      const R = Math.max(b.param('resistance'), 1e-9);
      b.conductance(a, bb, 1 / R);
      b.measure(() => {
        const v = b.V('a') - b.V('b');
        const i = v / R;
        b.reading = { voltage: v, current: i, power: v * i, pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 6. 电阻箱 (resistance box, discrete selectable)
  {
    type: 'resistanceBox',
    name: '电阻箱',
    category: 'load',
    pins: TWO_PIN,
    params: [{ key: 'resistance', label: '阻值', type: 'number', unit: 'Ω', min: 0, max: 9999, step: 1, default: 10 }],
    defaults: { resistance: 10 },
    mainPins: ['a', 'b'],
    stamp(b, comp) {
      const a = b.node('a');
      const bb = b.node('b');
      const R = Math.max(b.param('resistance'), 1e-9);
      b.conductance(a, bb, 1 / R);
      b.measure(() => {
        const v = b.V('a') - b.V('b');
        const i = v / R;
        b.reading = { voltage: v, current: i, power: v * i, pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 7. 电流表 (ammeter, ideal ~0Ω current probe)
  {
    type: 'ammeter',
    name: '电流表',
    category: 'meter',
    pins: TWO_PIN,
    params: [
      { key: 'range', label: '量程', type: 'select', default: '3A', options: [{ value: '0.6A', label: '0~0.6A' }, { value: '3A', label: '0~3A' }] },
    ],
    defaults: { range: '3A' },
    mainPins: ['a', 'b'],
    stamp(b) {
      const a = b.node('a');
      const bb = b.node('b');
      const k = b.addBranch();
      b.voltageSource(a, bb, 0, k);
      b.measure(() => {
        // I[k] is current INTO pin 'a' (a->b external direction).
        const i = b.I(k);
        b.reading = { current: i, measured: i, voltage: b.V('a') - b.V('b'), pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 8. 电压表 (voltmeter, very high internal resistance)
  {
    type: 'voltmeter',
    name: '电压表',
    category: 'meter',
    pins: TWO_PIN,
    params: [
      { key: 'range', label: '量程', type: 'select', default: '15V', options: [{ value: '3V', label: '0~3V' }, { value: '15V', label: '0~15V' }] },
    ],
    defaults: { range: '15V' },
    mainPins: ['a', 'b'],
    stamp(b) {
      const a = b.node('a');
      const bb = b.node('b');
      const Rm = 1e7;
      b.conductance(a, bb, 1 / Rm);
      b.measure(() => {
        const v = b.V('a') - b.V('b');
        b.reading = { voltage: v, measured: v, current: v / Rm, pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 9. 电流计 (galvanometer, zero-center sensitive current indicator)
  {
    type: 'galvanometer',
    name: '电流计',
    category: 'meter',
    pins: TWO_PIN,
    params: [{ key: 'range', label: '量程', type: 'select', default: '0.5A', options: [{ value: '0.5A', label: '0~±0.5A' }, { value: '1A', label: '0~±1A' }] }],
    defaults: { range: '0.5A' },
    mainPins: ['a', 'b'],
    stamp(b) {
      const a = b.node('a');
      const bb = b.node('b');
      const k = b.addBranch();
      b.voltageSource(a, bb, 0, k);
      b.measure(() => {
        const i = b.I(k);
        b.reading = { current: i, measured: i, voltage: b.V('a') - b.V('b'), pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 10. 导线 (wire, equipotential pass-through)
  {
    type: 'wire',
    name: '导线',
    category: 'wire',
    pins: TWO_PIN,
    params: [],
    defaults: {},
    equipotential: () => [['a', 'b']],
  },

  // 11. 接线柱 (binding post, equipotential pass-through)
  {
    type: 'terminal',
    name: '接线柱',
    category: 'wire',
    pins: TWO_PIN,
    params: [],
    defaults: {},
    equipotential: () => [['a', 'b']],
  },

  // 12. 注释文字 (annotation, no electrical behavior)
  {
    type: 'annotation',
    name: '注释文字',
    category: 'annotation',
    pins: [],
    params: [{ key: 'text', label: '文字', type: 'text', default: '注释' }],
    defaults: { text: '注释' },
    passive: true,
  },

  // 13. 电动机 (motor) — 线圈电阻 + 反电动势模型
  {
    type: 'motor',
    name: '电动机',
    category: 'load',
    pins: TWO_PIN,
    params: [
      { key: 'coilResistance', label: '线圈电阻', type: 'number', unit: 'Ω', min: 0, max: 100, step: 0.1, default: 2 },
      { key: 'backEMF', label: '反电动势', type: 'number', unit: 'V', min: 0, max: 50, step: 0.1, default: 1 },
    ],
    defaults: { coilResistance: 2, backEMF: 1 },
    mainPins: ['a', 'b'],
    stamp(b, comp) {
      const a = b.node('a');
      const bb = b.node('b');
      const R = Math.max(b.param('coilResistance'), 1e-9);
      const E = b.param('backEMF');
      const m = b.addNode();
      const k = b.addBranch();
      b.conductance(a, m, 1 / R);
      b.voltageSource(m, bb, E, k);
      b.measure(() => {
        const I = b.I(k);
        const U = b.V('a') - b.V('b');
        b.reading = { voltage: U, current: I, power: U * I, pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 14. 发光二极管 (LED) — 简化线性模型：固定正向压降
  {
    type: 'led',
    name: '发光二极管',
    category: 'load',
    pins: TWO_PIN,
    params: [
      { key: 'forwardVoltage', label: '正向压降', type: 'number', unit: 'V', min: 0.5, max: 5, step: 0.1, default: 2 },
    ],
    defaults: { forwardVoltage: 2 },
    mainPins: ['a', 'b'],
    stamp(b, comp) {
      const a = b.node('a');
      const bb = b.node('b');
      const Vf = b.param('forwardVoltage');
      const k = b.addBranch();
      b.voltageSource(a, bb, Vf, k);
      b.measure(() => {
        const I = b.I(k);
        const lit = I > 0; // 正向导通才发光
        b.reading = { voltage: b.V('a') - b.V('b'), current: I, power: lit ? I * Vf : 0, measured: lit ? 1 : 0, pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 15. 电铃 (bell) — 电磁铁线圈，直流等效为电阻
  {
    type: 'bell',
    name: '电铃',
    category: 'load',
    pins: TWO_PIN,
    params: [
      { key: 'resistance', label: '线圈电阻', type: 'number', unit: 'Ω', min: 0, max: 1000, step: 1, default: 10 },
    ],
    defaults: { resistance: 10 },
    mainPins: ['a', 'b'],
    stamp(b, comp) {
      const a = b.node('a');
      const bb = b.node('b');
      const R = Math.max(b.param('resistance'), 1e-9);
      b.conductance(a, bb, 1 / R);
      b.measure(() => {
        const v = b.V('a') - b.V('b');
        const i = v / R;
        b.reading = { voltage: v, current: i, power: v * i, pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 16. 保险丝 (fuse) — 小电阻，过载标记
  {
    type: 'fuse',
    name: '保险丝',
    category: 'load',
    pins: TWO_PIN,
    faultable: true,
    params: [
      { key: 'ratedCurrent', label: '额定电流', type: 'number', unit: 'A', min: 0.05, max: 20, step: 0.05, default: 0.5 },
    ],
    defaults: { ratedCurrent: 0.5 },
    mainPins: ['a', 'b'],
    stamp(b, comp, def) {
      const a = b.node('a');
      const bb = b.node('b');
      const Irated = b.param('ratedCurrent');
      const R = 0.01;
      b.conductance(a, bb, 1 / R);
      b.measure(() => {
        const v = b.V('a') - b.V('b');
        const i = v / R;
        b.reading = { voltage: v, current: i, power: v * i, measured: i > Irated ? 0 : 1, pinVoltages: { a: b.V('a'), b: b.V('b') } };
      });
    },
  },

  // 17. 读数标签 (reading label) — 显示附近元件的实时读数
  {
    type: 'readingLabel',
    name: '读数标签',
    category: 'annotation',
    pins: [],
    params: [
      { key: 'quantity', label: '显示量', type: 'select', default: 'voltage', options: [{ value: 'voltage', label: '电压 U' }, { value: 'current', label: '电流 I' }, { value: 'power', label: '功率 P' }, { value: 'all', label: '全部' }] },
    ],
    defaults: { quantity: 'voltage' },
    passive: true,
  },
];

const REGISTRY_MAP = new Map<string, ComponentDef>(REGISTRY.map((d) => [d.type, d]));

export function getComponentDef(type: string): ComponentDef | undefined {
  return REGISTRY_MAP.get(type);
}

export function getRegistry(): ComponentDef[] {
  return REGISTRY;
}

export function listComponentTypes(): string[] {
  return REGISTRY.map((d) => d.type);
}
