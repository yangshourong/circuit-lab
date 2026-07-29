// Core data contracts for the @circuit/core engine.
// These types are the shared boundary consumed by the Web UI, the mini-program UI,
// the task checker, and the Node test layer. Keep them DOM-free.

export type PinId = string;

export interface PinDef {
  id: PinId;
  /** Relative position in local component space (UI uses this for rendering/wiring). */
  x: number;
  y: number;
  label?: string;
}

export type ParamType = 'number' | 'select' | 'boolean' | 'text';

export interface ParamOption {
  value: string | number;
  label: string;
}

export interface ParamSchema {
  key: string;
  label: string;
  type: ParamType;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: ParamOption[];
  default: number | string | boolean;
  /** Whether the value can be hidden (unknown-element exam mode). */
  hideable?: boolean;
}

export type FaultState = 'normal' | 'open' | 'short';

export interface PlacedComponent {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation?: number;
  params: Record<string, number | string | boolean>;
  /** For faultable components: normal | open | short. */
  fault?: FaultState;
  /** For switches: closed state. */
  closed?: boolean;
  /** For exam mode: hide the parameter value from the student. */
  hidden?: boolean;
  label?: string;
  /** Custom pin positions for multi-pin components (local-space offsets). */
  pinPositions?: Record<string, { x: number; y: number }>;
  /** Flip polarity: swap pins a and b (positive/negative terminals). */
  flipPolarity?: boolean;
}

export interface PinRef {
  componentId: string;
  pin: PinId;
}

export interface Wire {
  id: string;
  from: PinRef;
  to: PinRef;
  path?: Array<[number, number]>;
  /** User-adjustable control points for physical-mode wire shaping.
   *  Includes endpoints (index 0 = from, last = to) + interior points.
   *  When absent, the default drape is computed automatically. */
  controlPoints?: Array<[number, number]>;
  /** Display label (auto-generated sequence number). */
  label?: string;
}

export interface CircuitGraph {
  components: PlacedComponent[];
  wires: Wire[];
}

/** Electrical behavior contract implemented by every component. */
export interface StampBuilder {
  /** Global node index for a pin of the current component, or -1 if disconnected. */
  node(pin: PinId): number;
  /** Allocate a branch-current unknown (voltage sources / ammeters). Returns its index. */
  addBranch(): number;
  /** Allocate an extra internal node (e.g. battery internal node). Returns its index. */
  addNode(): number;
  /** Stamp a conductance g between nodes a and b: G[a][a]+=g, G[a][b]-=g, G[b][a]-=g, G[b][b]+=g. */
  conductance(a: number, b: number, g: number): void;
  /** Stamp an ideal voltage source of emf E between a(+) and b(-) using branch current index k. */
  voltageSource(a: number, b: number, emf: number, k: number): void;
  /** Stamp a current source injecting i from node a into node b (leaves a toward b). */
  currentSource(a: number, b: number, i: number): void;
  /** Register a measurement closure run after the system is solved. */
  measure(fn: (b: StampBuilder) => void): void;
  /** Mutable scratch object the measure closures populate with readings. */
  reading: Record<string, unknown>;
  /** Voltage at a pin (0 if disconnected / unsolved). */
  V(pin: PinId): number;
  /** Branch current by index. */
  I(k: number): number;
  /** Resolved numeric parameter with fallback to the definition default. */
  param(key: string): number;
}

export type ComponentCategory = 'source' | 'load' | 'meter' | 'control' | 'wire' | 'annotation';

export interface ComponentDef {
  type: string;
  name: string;
  category: ComponentCategory;
  pins: PinDef[];
  params: ParamSchema[];
  defaults: Record<string, number | string | boolean>;
  /** Component can enter normal/open/short states. */
  faultable?: boolean;
  /** Two pins used for fault short/open (and connectivity grouping). */
  mainPins?: [PinId, PinId];
  /** Solver ignores entirely (annotation). */
  passive?: boolean;
  /** Pairs of pins that are equipotential (0-ohm) given current params. */
  equipotential?: (comp: PlacedComponent) => Array<[PinId, PinId]>;
  /** Build electrical equations; may register measurements. */
  stamp?: (b: StampBuilder, comp: PlacedComponent, def: ComponentDef) => void;
}

export interface ComponentReading {
  voltage?: number;
  current?: number;
  power?: number;
  /** For meters: the measured scalar (current for ammeters, voltage for voltmeters). */
  measured?: number;
  pinVoltages?: Record<string, number>;
}

export interface SolverResult {
  ok: boolean;
  error?: string;
  nodeCount: number;
  branchCount: number;
  readings: Record<string, ComponentReading>;
  /** Raw solved vector (node voltages then branch currents) for debugging. */
  solution?: number[];
  nodeVoltages?: number[];
  /** Wire currents: positive = from→to direction, negative = to→from. */
  wireCurrents?: Record<string, number>;
}
