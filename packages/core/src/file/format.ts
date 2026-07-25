import { CircuitGraph, PlacedComponent, Wire } from '../types';
import { getComponentDef, listComponentTypes } from '../components/registry';

export const FORMAT_VERSION = 1;

export interface ExperimentFile {
  formatVersion: number;
  kind: 'circuit-lab-experiment';
  meta: {
    title?: string;
    author?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  graph: CircuitGraph;
  view?: {
    mode?: 'physical' | 'schematic';
    zoom?: number;
    panX?: number;
    panY?: number;
  };
  task?: {
    id?: string;
    state?: Record<string, unknown>;
  };
}

export interface SerializeOptions {
  title?: string;
  author?: string;
  createdAt?: string;
  mode?: 'physical' | 'schematic';
  zoom?: number;
  panX?: number;
  panY?: number;
  taskId?: string;
  taskState?: Record<string, unknown>;
}

export function serializeExperiment(graph: CircuitGraph, opts: SerializeOptions = {}): ExperimentFile {
  const now = new Date().toISOString();
  return {
    formatVersion: FORMAT_VERSION,
    kind: 'circuit-lab-experiment',
    meta: {
      title: opts.title,
      author: opts.author,
      createdAt: opts.createdAt ?? now,
      updatedAt: now,
    },
    graph: JSON.parse(JSON.stringify(graph)),
    view: {
      mode: opts.mode ?? 'physical',
      zoom: opts.zoom,
      panX: opts.panX,
      panY: opts.panY,
    },
    task: opts.taskId ? { id: opts.taskId, state: opts.taskState ?? {} } : undefined,
  };
}

export interface DeserializeResult {
  ok: boolean;
  error?: string;
  file?: ExperimentFile;
  graph?: CircuitGraph;
}

/** Parse + validate an experiment file. Never throws; returns a structured error. */
export function deserializeExperiment(input: unknown): DeserializeResult {
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch (e) {
      return { ok: false, error: '文件不是合法的 JSON。' };
    }
  }
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '文件内容为空或格式不正确。' };
  }
  const obj = input as Record<string, unknown>;
  if (obj.formatVersion === undefined) {
    return { ok: false, error: '缺少 formatVersion 字段，可能不是本软件的实验文件。' };
  }
  if (!obj.graph || typeof obj.graph !== 'object') {
    return { ok: false, error: '缺少 graph 电路数据。' };
  }
  const graph = obj.graph as Record<string, unknown>;
  if (!Array.isArray(graph.components) || !Array.isArray(graph.wires)) {
    return { ok: false, error: 'graph 必须包含 components 与 wires 数组。' };
  }

  const validTypes = new Set(listComponentTypes());
  const compIds = new Set<string>();
  for (const c of graph.components as PlacedComponent[]) {
    if (!c.id || !c.type) return { ok: false, error: '存在缺少 id 或 type 的元件。' };
    if (!validTypes.has(c.type)) return { ok: false, error: `未知元件类型：${c.type}` };
    compIds.add(c.id);
  }

  const knownPins = new Map<string, Set<string>>();
  for (const c of graph.components as PlacedComponent[]) {
    const def = getComponentDef(c.type)!;
    knownPins.set(c.id, new Set(def.pins.map((p) => p.id)));
  }
  for (const w of graph.wires as Wire[]) {
    for (const ref of [w.from, w.to]) {
      if (!compIds.has(ref.componentId)) return { ok: false, error: `导线引用了不存在的元件：${ref.componentId}` };
      const pins = knownPins.get(ref.componentId)!;
      if (!pins.has(ref.pin)) return { ok: false, error: `元件 ${ref.componentId} 不存在引脚 ${ref.pin}` };
    }
  }

  const file = obj as unknown as ExperimentFile;
  return { ok: true, file, graph: file.graph };
}
