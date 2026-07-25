import { useRef } from 'react';
import type React from 'react';
import { useStore } from '../store';
import { serializeExperiment, deserializeExperiment } from '@circuit/core';
import { exportSvgToPng, downloadText, readFileAsText } from '../fileio';

export function Toolbar() {
  const view = useStore((s) => s.view);
  const largeScreen = useStore((s) => s.largeScreen);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const zoomBy = useStore((s) => s.zoomBy);
  const resetView = useStore((s) => s.resetView);
  const setMode = useStore((s) => s.setMode);
  const toggleLargeScreen = useStore((s) => s.toggleLargeScreen);
  const toggleReadings = useStore((s) => s.toggleReadings);
  const showReadings = useStore((s) => s.showReadings);
  const loadGraph = useStore((s) => s.loadGraph);
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const removeSelected = useStore((s) => s.removeSelected);
  const selectedCount = useStore((s) => s.selectedIds.length);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSave = () => {
    const st = useStore.getState();
    const file = serializeExperiment(st.graph, {
      mode: st.view.mode,
      zoom: st.view.zoom,
      panX: st.view.panX,
      panY: st.view.panY,
      taskId: st.activeTaskId ?? undefined,
    });
    downloadText(JSON.stringify(file, null, 2), 'experiment.circuit.json');
  };

  const onOpenClick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const text = await readFileAsText(f);
      const res = deserializeExperiment(text);
      if (!res.ok || !res.graph) {
        alert('打开失败：' + (res.error ?? '未知错误'));
        return;
      }
      const v = res.file?.view;
      loadGraph(res.graph, v ? { mode: v.mode, zoom: v.zoom, panX: v.panX, panY: v.panY } : undefined);
    } catch (err) {
      alert('打开失败：' + String(err));
    }
  };

  const onPng = () => {
    const svg = document.querySelector('svg.editor-svg') as SVGSVGElement | null;
    if (!svg) {
      alert('未找到画布。');
      return;
    }
    exportSvgToPng(svg, 'circuit.png').catch((err) => alert('PNG 导出失败：' + String(err)));
  };

  return (
    <div className="toolbar">
      <span className="brand">智能电路实验室</span>
      <div className="tb-group seg">
        <button
          type="button"
          className={tool === 'select' ? 'seg-btn active' : 'seg-btn'}
          onClick={() => setTool('select')}
          title="选择工具：点击选中、拖拽移动、框选多个"
        >
          ⬚ 选择
        </button>
        <button
          type="button"
          className={tool === 'wire' ? 'seg-btn active' : 'seg-btn'}
          onClick={() => setTool('wire')}
          title="连线工具：依次点击两个接线柱即可连接（也可拖拽）"
        >
          ／ 连线
        </button>
      </div>
      <div className="tb-group">
        <button
          type="button"
          className="btn danger-tb"
          disabled={selectedCount === 0}
          onClick={removeSelected}
          title="删除选中的元件或导线 (Delete)"
        >
          🗑 删除{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </button>
      </div>
      <div className="tb-group">
        <button type="button" className="btn" disabled={!canUndo} onClick={undo} title="撤销 (Ctrl+Z)">
          ↶ 撤销
        </button>
        <button type="button" className="btn" disabled={!canRedo} onClick={redo} title="重做 (Ctrl+Shift+Z)">
          ↷ 重做
        </button>
      </div>
      <div className="tb-group">
        <button type="button" className="btn" onClick={() => zoomBy(1 / 1.2)} title="缩小">
          −
        </button>
        <span className="zoom-label">{Math.round(view.zoom * 100)}%</span>
        <button type="button" className="btn" onClick={() => zoomBy(1.2)} title="放大">
          ＋
        </button>
        <button type="button" className="btn" onClick={resetView} title="复位视图">
          复位
        </button>
      </div>
      <div className="tb-group seg">
        <button
          type="button"
          className={view.mode === 'physical' ? 'seg-btn active' : 'seg-btn'}
          onClick={() => setMode('physical')}
        >
          实物视图
        </button>
        <button
          type="button"
          className="seg-btn"
          onClick={() => alert('简化电路图功能正在重构中，敬请期待。')}
          title="功能开发中"
        >
          简化电路图
        </button>
      </div>
      <div className="tb-group">
        <button
          type="button"
          className={largeScreen ? 'btn active' : 'btn'}
          onClick={toggleLargeScreen}
          title="大屏模式：放大所有读数（课堂投影）"
        >
          大屏模式
        </button>
        <button
          type="button"
          className={showReadings ? 'btn active' : 'btn'}
          onClick={toggleReadings}
          title="显示/隐藏元件的实时电压、电流、功率标注"
        >
          {showReadings ? '隐藏读数' : '显示读数'}
        </button>
      </div>
      <div className="tb-group">
        <button type="button" className="btn" onClick={onSave}>
          保存
        </button>
        <button type="button" className="btn" onClick={onOpenClick}>
          打开
        </button>
        <button type="button" className="btn" onClick={onPng}>
          导出PNG
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
      </div>
    </div>
  );
}
