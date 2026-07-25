import { create } from 'zustand';
import {
  getComponentDef,
  type CircuitGraph,
  type PlacedComponent,
  type Wire,
  type PinRef,
  type SolverResult,
  type FaultState,
} from '@circuit/core';
import type { Breakpoint, Tool, ViewMode } from './types';

export const GRID = 10;
/** Snap a world coordinate to the grid. */
export const snap = (v: number): number => Math.round(v / GRID) * GRID;

/** Pin anchor offset used for rendering & wiring. The provided art places its
 *  visual pins at art-x 8 / 112 inside a 120-wide box, i.e. ±52 from the
 *  component centre. We align our wiring anchors to the visual pins. */
export const PIN_OFFSET = 52;

const HISTORY_LIMIT = 100;
const CHART_LIMIT = 400;

let idCounter = 0;
const newId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

export interface ChartPoint {
  t: number;
  v: number;
  i: number;
}


export interface ViewState {
  mode: ViewMode;
  zoom: number;
  panX: number;
  panY: number;
}

interface ParamKey {
  id: string;
  key: string;
  t: number;
}

interface StoreState {
  graph: CircuitGraph;
  past: CircuitGraph[];
  future: CircuitGraph[];
  selectedIds: string[];
  tool: Tool;
  /** Pending first endpoint while click-to-click wiring; null when idle. */
  wireStart: PinRef | null;
  view: ViewState;
  viewSize: { w: number; h: number };
  breakpoint: Breakpoint;
  placeType: string | null;
  largeScreen: boolean;
  showReadings: boolean;
  solver: SolverResult | null;
  solverError: string | null;
  activeTaskId: string | null;
  chart: ChartPoint[];
  _base: CircuitGraph | null;
  _lastParam: ParamKey | null;

  // --- component / wire editing ---
  addComponent: (type: string, x: number, y: number) => void;
  addWire: (from: PinRef, to: PinRef, path?: Array<[number, number]>) => void;
  removeWire: (id: string) => void;
  removeSelected: () => void;
  updateParam: (id: string, key: string, value: number | string | boolean) => void;
  setFault: (id: string, fault: FaultState) => void;
  setClosed: (id: string, closed: boolean) => void;
  setFlipPolarity: (id: string, flip: boolean) => void;
  setLabel: (id: string, label: string) => void;
  setRotation: (id: string, rotation: number) => void;

  // --- selection ---
  selectOnly: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;

  // --- tool / wiring ---
  setTool: (tool: Tool) => void;
  setWireStart: (pin: PinRef | null) => void;

  // --- drag gesture (single undo entry) ---
  beginGesture: () => void;
  setComponentPositionsLive: (positions: Record<string, { x: number; y: number }>) => void;
  endGesture: () => void;
  cancelGesture: () => void;

  // --- view ---
  setView: (patch: Partial<ViewState>) => void;
  setViewSize: (w: number, h: number) => void;
  setMode: (mode: ViewMode) => void;
  zoomBy: (factor: number) => void;
  panBy: (dx: number, dy: number) => void;
  resetView: () => void;
  setBreakpoint: (bp: Breakpoint) => void;
  setPlaceType: (type: string | null) => void;
  toggleLargeScreen: () => void;
  toggleReadings: () => void;

  // --- solver / chart ---
  setSolver: (solver: SolverResult | null, error: string | null) => void;
  recordChartSample: () => void;
  clearChart: () => void;

  // --- file / tasks ---
  loadGraph: (graph: CircuitGraph, view?: Partial<ViewState>) => void;
  setActiveTask: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
}

function pushHistory(state: StoreState): Pick<StoreState, 'past' | 'future'> {
  return {
    past: [...state.past, state.graph].slice(-HISTORY_LIMIT),
    future: [],
  };
}

/** Build a default PlacedComponent for a type at a snapped position. */
function makeComponent(type: string, x: number, y: number, defaultLabel?: string): PlacedComponent | null {
  const def = getComponentDef(type);
  if (!def) return null;
  const comp: PlacedComponent = {
    id: newId(type),
    type,
    x: snap(x),
    y: snap(y),
    params: { ...def.defaults },
  };
  if (defaultLabel) comp.label = defaultLabel;
  if (def.faultable) comp.fault = 'normal';
  if (def.params.some((p) => p.key === 'closed')) comp.closed = def.defaults.closed as boolean;
  // Store custom pin positions for multi-pin components (e.g. multiSwitch)
  if (def.pins.length > 2) {
    comp.pinPositions = {};
    for (const p of def.pins) {
      comp.pinPositions[p.id] = { x: p.x, y: p.y };
    }
  }
  return comp;
}

/** Empty graph — user starts with a blank canvas. */
function makeDemoGraph(): CircuitGraph {
  return { components: [], wires: [] };
}

export const useStore = create<StoreState>((set, get) => ({
  graph: makeDemoGraph(),
  past: [],
  future: [],
  selectedIds: [],
  tool: 'select',
  wireStart: null,
  view: { mode: 'physical', zoom: 1, panX: 220, panY: 260 },
  viewSize: { w: 800, h: 600 },
  largeScreen: false,
  breakpoint: 'desktop',
  placeType: null,
  showReadings: false,
  solver: null,
  solverError: null,
  activeTaskId: null,
  chart: [],
  _base: null,
  _lastParam: null,

  addComponent: (type, x, y) =>
    set((s) => {
      const def = getComponentDef(type);
      // 生成序号标签：同类型元件按数量递增（电源、电源1、电源2…）
      const sameType = s.graph.components.filter((c) => c.type === type).length;
      const defaultLabel = sameType === 0 ? def?.name : `${def?.name}${sameType}`;
      const comp = makeComponent(type, x, y, defaultLabel);
      if (!comp) return {};
      const graph: CircuitGraph = { ...s.graph, components: [...s.graph.components, comp] };
      return { graph, ...pushHistory(s), selectedIds: [comp.id] };
    }),

  addWire: (from, to, path) =>
    set((s) => {
      if (from.componentId === to.componentId && from.pin === to.pin) return {};
      const exists = s.graph.wires.some(
        (w) =>
          (w.from.componentId === from.componentId &&
            w.from.pin === from.pin &&
            w.to.componentId === to.componentId &&
            w.to.pin === to.pin) ||
          (w.from.componentId === to.componentId &&
            w.from.pin === to.pin &&
            w.to.componentId === from.componentId &&
            w.to.pin === from.pin)
      );
      if (exists) return {};
      const seq = s.graph.wires.length + 1;
      const graph: CircuitGraph = {
        ...s.graph,
        wires: [...s.graph.wires, { id: newId('wire'), from, to, label: `导线${seq}`, ...(path && path.length >= 2 ? { path } : {}) }],
      };
      return { graph, ...pushHistory(s), wireStart: null };
    }),

  removeWire: (id) =>
    set((s) => {
      const graph: CircuitGraph = { ...s.graph, wires: s.graph.wires.filter((w) => w.id !== id) };
      return { graph, ...pushHistory(s) };
    }),

  removeSelected: () =>
    set((s) => {
      if (s.selectedIds.length === 0) return {};
      const ids = new Set(s.selectedIds);
      const graph: CircuitGraph = {
        components: s.graph.components.filter((c) => !ids.has(c.id)),
        wires: s.graph.wires.filter(
          (w) => !ids.has(w.from.componentId) && !ids.has(w.to.componentId) && !ids.has(w.id)
        ),
      };
      return { graph, ...pushHistory(s), selectedIds: [] };
    }),

  updateParam: (id, key, value) =>
    set((s) => {
      const graph: CircuitGraph = {
        ...s.graph,
        components: s.graph.components.map((c) =>
          c.id === id ? { ...c, params: { ...c.params, [key]: value } } : c
        ),
      };
      const now = Date.now();
      const last = s._lastParam;
      // Coalesce rapid slider edits on the same control into one undo entry.
      if (last && last.id === id && last.key === key && now - last.t < 700) {
        return { graph, _lastParam: { id, key, t: now } };
      }
      return { graph, ...pushHistory(s), _lastParam: { id, key, t: now } };
    }),

  setFault: (id, fault) =>
    set((s) => ({
      graph: {
        ...s.graph,
        components: s.graph.components.map((c) => (c.id === id ? { ...c, fault } : c)),
      },
      ...pushHistory(s),
    })),

  setClosed: (id, closed) =>
    set((s) => ({
      graph: {
        ...s.graph,
        components: s.graph.components.map((c) => (c.id === id ? { ...c, closed } : c)),
      },
      ...pushHistory(s),
    })),

  setFlipPolarity: (id, flip) =>
    set((s) => ({
      graph: {
        ...s.graph,
        components: s.graph.components.map((c) => (c.id === id ? { ...c, flipPolarity: flip } : c)),
      },
      ...pushHistory(s),
    })),

  setLabel: (id, label) =>
    set((s) => ({
      graph: {
        ...s.graph,
        components: s.graph.components.map((c) => (c.id === id ? { ...c, label } : c)),
      },
      ...pushHistory(s),
    })),

  setRotation: (id, rotation) =>
    set((s) => ({
      graph: {
        ...s.graph,
        components: s.graph.components.map((c) => (c.id === id ? { ...c, rotation } : c)),
      },
      ...pushHistory(s),
    })),

  selectOnly: (id) => set({ selectedIds: [id] }),
  toggleSelect: (id) =>
    set((s) =>
      s.selectedIds.includes(id)
        ? { selectedIds: s.selectedIds.filter((x) => x !== id) }
        : { selectedIds: [...s.selectedIds, id] }
    ),
  selectMany: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),

  setTool: (tool) =>
    set(() => {
      if (tool === 'wire') return { tool, wireStart: null, selectedIds: [], placeType: null };
      if (tool === 'place') return { tool, placeType: null, wireStart: null };
      return { tool, wireStart: null, placeType: null };
    }),
  setWireStart: (pin) => set({ wireStart: pin }),

  beginGesture: () => set((s) => ({ _base: s.graph })),
  setComponentPositionsLive: (positions) =>
    set((s) => ({
      graph: {
        ...s.graph,
        components: s.graph.components.map((c) =>
          positions[c.id] ? { ...c, x: positions[c.id].x, y: positions[c.id].y } : c
        ),
      },
    })),
  endGesture: () =>
    set((s) => {
      if (!s._base || s._base === s.graph) return { _base: null };
      return {
        past: [...s.past, s._base].slice(-HISTORY_LIMIT),
        future: [],
        _base: null,
      };
    }),
  cancelGesture: () => set((s) => (s._base ? { graph: s._base, _base: null } : { _base: null })),

  setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
  setViewSize: (w, h) => set({ viewSize: { w, h } }),
  setMode: (mode) => set((s) => ({ view: { ...s.view, mode } })),
  zoomBy: (factor) =>
    set((s) => {
      const v = s.view;
      const { w, h } = s.viewSize;
      const cx = w / 2;
      const cy = h / 2;
      const worldX = (cx - v.panX) / v.zoom;
      const worldY = (cy - v.panY) / v.zoom;
      const zoom = Math.min(4, Math.max(0.2, v.zoom * factor));
      return {
        view: { ...v, zoom, panX: cx - worldX * zoom, panY: cy - worldY * zoom },
      };
    }),
  panBy: (dx, dy) =>
    set((s) => ({ view: { ...s.view, panX: s.view.panX + dx, panY: s.view.panY + dy } })),
  resetView: () =>
    set((s) => ({ view: { ...s.view, zoom: 1, panX: 120, panY: s.viewSize.h / 2 } })),
  setBreakpoint: (bp) => set(() => ({ breakpoint: bp, largeScreen: bp === 'desktop' })),
  setPlaceType: (type) => set({ placeType: type }),
  toggleLargeScreen: () => set((s) => ({ largeScreen: !s.largeScreen, breakpoint: s.largeScreen ? 'tablet' : 'desktop' })),
  toggleReadings: () => set((s) => ({ showReadings: !s.showReadings })),

  setSolver: (solver, solverError) => set({ solver, solverError }),

  recordChartSample: () =>
    set((s) => {
      const sol = s.solver;
      if (!sol || !sol.ok) return {};
      const g = s.graph;
      const batt = g.components.find((c) => c.type === 'battery');
      const amm = g.components.find((c) => c.type === 'ammeter');
      const vol = g.components.find((c) => c.type === 'voltmeter');
      const lamp = g.components.find((c) => c.type === 'lamp');
      let v = 0;
      let i = 0;
      if (batt && sol.readings[batt.id]) {
        i = sol.readings[batt.id].current ?? 0;
        v = sol.readings[batt.id].voltage ?? 0;
      } else if (amm && vol) {
        i = sol.readings[amm.id]?.measured ?? sol.readings[amm.id]?.current ?? 0;
        v = sol.readings[vol.id]?.measured ?? sol.readings[vol.id]?.voltage ?? 0;
      } else if (lamp) {
        i = sol.readings[lamp.id]?.current ?? 0;
        v = sol.readings[lamp.id]?.voltage ?? 0;
      } else {
        return {};
      }
      const last = s.chart[s.chart.length - 1];
      if (last && Math.abs(last.v - v) < 1e-6 && Math.abs(last.i - i) < 1e-6) return {};
      return { chart: [...s.chart, { t: Date.now(), v, i }].slice(-CHART_LIMIT) };
    }),

  clearChart: () => set({ chart: [] }),

  loadGraph: (graph, view) =>
    set((s) => ({
      graph,
      past: [],
      future: [],
      selectedIds: [],
      chart: [],
      ...(view ? { view: { ...s.view, ...view } } : {}),
    })),

  setActiveTask: (id) => set({ activeTaskId: id }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return {};
      const prev = s.past[s.past.length - 1];
      return {
        graph: prev,
        past: s.past.slice(0, -1),
        future: [s.graph, ...s.future].slice(0, HISTORY_LIMIT),
        selectedIds: [],
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {};
      const next = s.future[0];
      return {
        graph: next,
        future: s.future.slice(1),
        past: [...s.past, s.graph].slice(-HISTORY_LIMIT),
        selectedIds: [],
      };
    }),
}));
