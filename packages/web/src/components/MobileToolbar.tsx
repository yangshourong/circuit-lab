import { useStore } from '../store';

interface Props {
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

export function MobileToolbar({ onToggleLeft, onToggleRight }: Props) {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const selectedIds = useStore((s) => s.selectedIds);
  const removeSelected = useStore((s) => s.removeSelected);

  return (
    <div className="mobile-toolbar">
      {/* 选择工具 */}
      <button
        type="button"
        className={tool === 'select' ? 'active' : ''}
        onClick={() => setTool('select')}
      >
        <span className="icon">⬚</span>
        <span>选择</span>
      </button>

      {/* 连线工具 */}
      <button
        type="button"
        className={tool === 'wire' ? 'active' : ''}
        onClick={() => setTool('wire')}
      >
        <span className="icon">／</span>
        <span>连线</span>
      </button>

      {/* 添加元件 — 打开左侧面板 */}
      <button type="button" onClick={onToggleLeft}>
        <span className="icon">＋</span>
        <span>元件</span>
      </button>

      {/* 撤销 */}
      <button type="button" disabled={!canUndo} onClick={undo}>
        <span className="icon">↶</span>
        <span>撤销</span>
      </button>

      {/* 重做 */}
      <button type="button" disabled={!canRedo} onClick={redo}>
        <span className="icon">↷</span>
        <span>重做</span>
      </button>

      {/* 删除 */}
      <button type="button" disabled={selectedIds.length === 0} onClick={removeSelected}>
        <span className="icon">🗑</span>
        <span>删除</span>
      </button>

      {/* 属性/数据 — 打开右侧面板 */}
      <button type="button" onClick={onToggleRight}>
        <span className="icon">📊</span>
        <span>属性</span>
      </button>
    </div>
  );
}
