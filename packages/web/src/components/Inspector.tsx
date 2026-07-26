import { useStore } from '../store';
import { getComponentDef } from '@circuit/core';
import type { ParamSchema, FaultState } from '../types';
import { fmt } from '../geometry';

export function Inspector() {
  const selectedIds = useStore((s) => s.selectedIds);
  const graph = useStore((s) => s.graph);
  const solver = useStore((s) => s.solver);
  const updateParam = useStore((s) => s.updateParam);
  const setFault = useStore((s) => s.setFault);
  const setClosed = useStore((s) => s.setClosed);
  const setFlipPolarity = useStore((s) => s.setFlipPolarity);
  const setLabel = useStore((s) => s.setLabel);
  const setRotation = useStore((s) => s.setRotation);
  const removeSelected = useStore((s) => s.removeSelected);

  if (selectedIds.length === 0) {
    return (
      <div className="panel inspector">
        <div className="panel-title">属性</div>
        <div className="empty-hint">在画布中选择一个元件以编辑其参数。</div>
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div className="panel inspector">
        <div className="panel-title">属性</div>
        <div className="empty-hint">已选中 {selectedIds.length} 个元件。</div>
        <button type="button" className="btn danger" onClick={removeSelected}>
          删除选中 ({selectedIds.length})
        </button>
      </div>
    );
  }

  const id = selectedIds[0];
  const comp = graph.components.find((c) => c.id === id);
  if (!comp) {
    // A wire (connection) is selected — offer deletion.
    const isWire = graph.wires.some((w) => w.id === id);
    if (isWire) {
      return (
        <div className="panel inspector">
          <div className="panel-title">属性 · 导线</div>
          <div className="empty-hint">已选中一段导线连接。</div>
          <button type="button" className="btn danger" onClick={removeSelected}>
            删除导线 (Del)
          </button>
        </div>
      );
    }
    return null;
  }
  const def = getComponentDef(comp.type);
  if (!def) return null;
  const reading = solver?.readings[id];

  const onParam = (schema: ParamSchema, value: number | string | boolean) => {
    if (schema.key === 'closed') setClosed(id, Boolean(value));
    else updateParam(id, schema.key, value);
  };

  return (
    <div className="panel inspector">
      <div className="panel-title">
        属性 · {def.name}
      </div>

      <div className="field">
        <label>标签</label>
        <input
          type="text"
          value={comp.label ?? ''}
          placeholder="（可选）"
          onChange={(e) => setLabel(id, e.target.value)}
        />
      </div>

      {def.params.map((schema) => (
        <div className="field" key={schema.key}>
          <label>
            {schema.label}
            {schema.unit ? ` (${schema.unit})` : ''}
          </label>
          {schema.type === 'number' && (
            <div className="row">
              <input
                type="range"
                min={schema.min ?? 0}
                max={schema.max ?? 100}
                step={schema.step ?? 1}
                value={Number(comp.params[schema.key] ?? schema.default)}
                onChange={(e) => onParam(schema, Number(e.target.value))}
                className="slider"
              />
              <span className="num">{fmt(Number(comp.params[schema.key] ?? schema.default))}</span>
            </div>
          )}
          {schema.type === 'select' && (
            <select
              value={String(comp.params[schema.key] ?? schema.default)}
              onChange={(e) => onParam(schema, e.target.value)}
            >
              {(schema.options ?? []).map((o) => (
                <option key={String(o.value)} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {schema.type === 'boolean' && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={schema.key === 'closed' ? comp.closed !== false : Boolean(comp.params[schema.key] ?? schema.default)}
                onChange={(e) => onParam(schema, e.target.checked)}
              />
              {schema.label}
            </label>
          )}
          {schema.type === 'text' && (
            <input
              type="text"
              value={String(comp.params[schema.key] ?? schema.default)}
              onChange={(e) => onParam(schema, e.target.value)}
            />
          )}
        </div>
      ))}

      {def.faultable && (
        <div className="field">
          <label>故障设置</label>
          <select value={comp.fault ?? 'normal'} onChange={(e) => setFault(id, e.target.value as FaultState)}>
            <option value="normal">正常</option>
            <option value="open">断路 (open)</option>
            <option value="short">短路 (short)</option>
          </select>
        </div>
      )}

      <div className="field">
        <label>旋转 (°)</label>
        <div className="row">
          <input
            type="range"
            min={0}
            max={360}
            step={15}
            value={comp.rotation ?? 0}
            onChange={(e) => setRotation(id, Number(e.target.value))}
            className="slider"
          />
          <span className="num">{comp.rotation ?? 0}°</span>
        </div>
      </div>

      {def.pins.length >= 2 && (
        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={comp.flipPolarity === true}
              onChange={(e) => setFlipPolarity(id, e.target.checked)}
            />
            正负极翻转
          </label>
        </div>
      )}

      {reading && (
        <div className="readings-box">
          <div className="panel-subtitle">实测数据</div>
          <div>电压 U = {fmt(reading.voltage)} V</div>
          <div>电流 I = {fmt(reading.current)} A</div>
          <div>功率 P = {fmt(reading.power, 3)} W</div>
          {reading.measured != null && <div>读数 = {fmt(reading.measured)}</div>}
        </div>
      )}

      <button type="button" className="btn danger" onClick={removeSelected}>
        删除元件 (Del)
      </button>
    </div>
  );
}
