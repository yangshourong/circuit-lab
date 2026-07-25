// Re-export the engine's public types so the UI only imports from one place.
export type {
  CircuitGraph,
  PlacedComponent,
  Wire,
  PinRef,
  ComponentDef,
  ComponentReading,
  SolverResult,
  ParamSchema,
  FaultState,
} from '@circuit/core';

export type ViewMode = 'physical' | 'schematic';
