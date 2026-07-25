# 智能电路实验室 (Intelligent Circuit Lab)

Monorepo: 纯 TS 电路仿真引擎 + Vite/React/SVG Web 编辑器。面向中学物理实验教学。

## Project

- **Stack**: TypeScript monorepo (`npm workspaces`), Node 22, TypeScript 5
- **Packages**:
  - `packages/core` — `@circuit/core` — 零 DOM 依赖的电路仿真引擎 (MNA 直流稳态求解器)
  - `packages/web` — `@circuit/web` — Vite + React 18 + zustand + SVG 编辑器
- **Entry points**: `packages/core/src/index.ts` (public API), `packages/web/index.html` → `src/main.tsx`

## Commands

```bash
# Core engine — build
cd packages/core && npx tsc -p tsconfig.json

# Core engine — type-check only
cd packages/core && npx tsc -p tsconfig.json --noEmit

# Core engine — run benchmark regression suite (also "test")
cd packages/core && npx tsx tests/benchmarks.test.ts

# Web — dev server on :5173
cd packages/web && npx vite

# Web — build for production (type-check + vite build)
cd packages/web && npx vite build

# Web — type-check
cd packages/web && npx tsc -p tsconfig.json --noEmit
```

> **Note**: Always use `./node_modules/.bin/tsc` (or `npx tsc`), never bare `tsc` — the global `tsc` package is a different, abandoned CLI tool.

## Architecture

### Core engine (`packages/core/src/`)

| Module | Role |
|---|---|
| `types.ts` | All shared data contracts: `PlacedComponent`, `Wire`, `CircuitGraph`, `SolverResult`, `StampBuilder`, `ComponentDef`, etc. |
| `solver/mna.ts` | MNA DC steady-state solver: union-find equipotential merging → node indexing → stamping → solve → measurements |
| `solver/matrix.ts` | Gauss-Jordan elimination with **complete (row+column) pivoting** (required because MNA places branch-current unknowns in KCL rows with zero diagonals) |
| `components/registry.ts` | 12 component definitions (battery, switch, lamp, resistor, rheostat, resistanceBox, ammeter, voltmeter, galvanometer, wire, terminal, annotation) — each with pins, params, stamp behavior, fault support |
| `file/format.ts` | JSON serialization/deserialization with validation (`ExperimentFile` format v1) |

### Web UI (`packages/web/src/`)

| Module | Role |
|---|---|
| `main.tsx` | React entry point — mount `<App />`, register service worker for PWA |
| `App.tsx` | Top-level layout: Toolbar + left (Palette,Tasks) + center (Editor) + right (Inspector,Chart), auto-solve with debounce |
| `store.ts` | zustand store — full undo/redo, drag gesture, component/wire CRUD, view/zoom, solver integration, chart recording |
| `components/Editor.tsx` | SVG canvas: drag-drop, pin wiring, marquee select, pan/zoom, wheel zoom, grid |
| `components/ComponentView.tsx` | SVG rendering of placed components with selection highlight, fault markers, meter dials |
| `components/Inspector.tsx` | Property panel: param sliders/inputs, fault mode, rotation, live readings display |
| `components/Palette.tsx` | Component picker grid with drag-to-add and click-to-add |
| `components/Toolbar.tsx` | Top bar: undo/redo, zoom, view mode switch, large-screen toggle, save/open/export PNG |
| `components/Meter.tsx` | Live needle + digital readout for ammeter/voltmeter/galvanometer |
| `components/Chart.tsx` | U-I scatter plot panel with CSV export |
| `tasks/Tasks.tsx` | Experiment task panel (欧姆定律, 电功率, 串联分压) with real-time pass/fail |
| `tasks/definitions.ts` | Task definition types + 3 built-in experiment tasks |
| `geometry.ts` | Pin world/local coordinate helpers, formatting, meter range parsing |
| `fileio.ts` | Download (Blob/CSV/PNG), file upload, SVG→PNG export |
| `assets/components/art.ts` | Dual (physical/schematic) SVG vector art for all 12 components |
| `index.css` | Complete stylesheet: layout, toolbar, panels, palette, inspector, chart, tasks |
| `vite-env.d.ts` | Vite client type reference for `import.meta.env` |

### Data flow

User edits → zustand store (`graph`) → `solveCircuit(graph)` → `SolverResult` → rendered readings + chart

## Conventions

- **Language**: UI labels and user-facing strings in **Chinese** (zh-CN). Code identifiers, comments, and technical docs in **English**.
- **Naming**: camelCase for variables/functions, PascalCase for types/interfaces, kebab-case for files.
- **Imports**: Use `import type` for type-only imports. Path alias `@circuit/core` in Vite resolves to `../core/src/index.ts` directly (no separate build step).
- **Error handling**: Functions return structured result objects (`{ ok: boolean, error?: string, ... }`) instead of throwing. The solver never throws.
- **Testing**: Benchmark/regression suite in `packages/core/tests/benchmarks.test.ts` — each test case has a known analytical solution. Run with `npx tsx`, no test framework.
- **State management**: zustand store with undo/redo — every mutation that should be undoable calls `pushHistory`. Slider edits coalesced (700ms window). Drag gestures use `beginGesture/endGesture`.
- **Circuit modeling**: Components declare electrical behavior via `StampBuilder` (conductance, voltageSource, currentSource). Equipotential pins merged via union-find. Fault support (`normal/open/short`) handled by skipping stamp or shorting main pins.

## Notes

