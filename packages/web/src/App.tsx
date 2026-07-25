import { useCallback, useEffect, useRef } from 'react';
import { useStore } from './store';
import { Editor } from './components/Editor';
import { Inspector } from './components/Inspector';
import { Palette } from './components/Palette';
import { Toolbar } from './components/Toolbar';
import { Chart } from './components/Chart';
import { Tasks } from './tasks/Tasks';
import { solveCircuit } from '@circuit/core';

export default function App() {
  const graph = useStore((s) => s.graph);
  const largeScreen = useStore((s) => s.largeScreen);
  const solver = useStore((s) => s.solver);
  const solverError = useStore((s) => s.solverError);
  const setSolver = useStore((s) => s.setSolver);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const removeSelected = useStore((s) => s.removeSelected);

  // ---- auto-solve on graph change (debounced) ----
  const solveTimer = useRef<ReturnType<typeof setTimeout>>();
  const doSolve = useCallback(() => {
    const result = solveCircuit(graph);
    if (result.ok) {
      setSolver(result, null);
      // Auto-record chart sample (built-in dedup skips identical values)
      useStore.getState().recordChartSample();
    } else {
      setSolver(null, result.error ?? '求解失败');
    }
  }, [graph, setSolver]);

  useEffect(() => {
    clearTimeout(solveTimer.current);
    solveTimer.current = setTimeout(doSolve, 200);
    return () => clearTimeout(solveTimer.current);
  }, [graph, doSolve]);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, removeSelected]);

  return (
    <div className={`app${largeScreen ? ' large-screen' : ''}`}>
      <Toolbar />
      <div className="body">
        {/* left sidebar: palette + tasks */}
        <div className="left">
          <Palette />
          <Tasks />
        </div>

        {/* center: editor canvas */}
        <div className="stage">
          <Editor />
          {solverError && <div className="error-banner">⚠ {solverError}</div>}
          <StageHint />
          <ToolBadge />
        </div>

        {/* right sidebar: inspector + chart */}
        <div className="right">
          <Inspector />
          <Chart />
        </div>
      </div>
    </div>
  );
}

/** Bottom-left contextual help; text depends on the active tool. */
function StageHint() {
  const tool = useStore((s) => s.tool);
  return (
    <div className="stage-hint">
      {tool === 'wire'
        ? '连线模式：依次点击两个接线柱即可连接（也可按住拖拽）· Esc 退出'
        : '选择模式：点击选中 · 拖拽移动 · 框选多个 · Delete 删除 · 空格+拖拽平移 · 滚轮缩放'}
    </div>
  );
}

/** Prominent floating badge so the current mode is always obvious. */
function ToolBadge() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  if (tool !== 'wire') return null;
  return (
    <div className="tool-badge">
      <span className="dot" />
      连线模式
      <button type="button" className="btn tiny" onClick={() => setTool('select')}>
        完成
      </button>
    </div>
  );
}
