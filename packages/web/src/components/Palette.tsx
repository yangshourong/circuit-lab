import { getRegistry } from '@circuit/core';
import { useStore } from '../store';
import { COMPONENT_ART } from '../assets/components/art';

const DND_TYPE = 'application/x-circuit-component';

export function Palette() {
  // 「导线」不再作为可放置元件出现；元件之间的连接改由工具栏的「连线」工具完成。
  const components = getRegistry().filter((d) => d.type !== 'wire');
  const breakpoint = useStore((s) => s.breakpoint);
  const setTool = useStore((s) => s.setTool);
  const setPlaceType = useStore((s) => s.setPlaceType);

  const isMobile = breakpoint === 'mobile' || breakpoint === 'tablet';

  const addAtCenter = (type: string) => {
    const st = useStore.getState();
    const { view, viewSize } = st;
    const wx = (viewSize.w / 2 - view.panX) / view.zoom;
    const wy = (viewSize.h / 2 - view.panY) / view.zoom;
    st.addComponent(type, wx, wy);
  };

  const handleClick = (type: string) => {
    if (isMobile) {
      // Mobile: enter place mode — user taps on canvas to position
      setPlaceType(type);
      setTool('place');
    } else {
      addAtCenter(type);
    }
  };

  return (
    <div className="panel palette">
      <div className="panel-title">元器件</div>
      <div className="palette-grid">
        {components.map((def) => {
          const art = COMPONENT_ART[def.type]?.physical ?? '';
          return (
            <button
              key={def.type}
              type="button"
              className="palette-item"
              title={`拖拽或点击添加：${def.name}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DND_TYPE, def.type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => handleClick(def.type)}
            >
              <svg width={58} height={34} viewBox="0 0 120 70" className="palette-thumb">
                <g dangerouslySetInnerHTML={{ __html: art }} />
              </svg>
              <span className="palette-name">{def.name}</span>
            </button>
          );
        })}
      </div>
      <div className="palette-hint">
        拖拽到画布，或点击添加到视图中心。
        <br />
        连接元件请用工具栏的「连线」工具。
      </div>
    </div>
  );
}
