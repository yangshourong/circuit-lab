// Public API surface for @circuit/core.
// Zero DOM dependency — runs in browser, mini-program, and Node.

export * from './types';
export { solveCircuit } from './solver/mna';
export { solveLinear } from './solver/matrix';
export {
  REGISTRY,
  getComponentDef,
  getRegistry,
  listComponentTypes,
} from './components/registry';
export {
  FORMAT_VERSION,
  serializeExperiment,
  deserializeExperiment,
} from './file/format';
export type {
  ExperimentFile,
  SerializeOptions,
  DeserializeResult,
} from './file/format';
