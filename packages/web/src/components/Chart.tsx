import { useStore } from '../store';
import { downloadCsv } from '../fileio';
import type { ReactNode } from 'react';

const W = 320;
const H = 190;
const M = 34;

export function Chart() {
  const chart = useStore((s) => s.chart);
  const clearChart = useStore((s) => s.clearChart);

  let body: ReactNode;
  if (chart.length === 0) {
    body = <div className="empty-hint">改变电路参数（如电源电动势、电阻）即可采到 U–I 数据点。</div>;
  } else {
    const xs = chart.map((p) => p.i);
    const ys = chart.map((p) => p.v);
    const xmin = Math.min(0, ...xs);
    const xmax = Math.max(...xs, xmin + 1e-6);
    const ymin = Math.min(0, ...ys);
    const ymax = Math.max(...ys, ymin + 1e-6);
    const sx = (v: number) => M + ((v - xmin) / (xmax - xmin)) * (W - M - 10);
    const sy = (v: number) => H - M - ((v - ymin) / (ymax - ymin)) * (H - M - 10);
    const poly = chart.map((p) => `${sx(p.i).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');

    body = (
      <svg width={W} height={H} className="chart-svg">
        <rect x={0} y={0} width={W} height={H} fill="#fff" />
        <line x1={M} y1={H - M} x2={W - 8} y2={H - M} stroke="#94a3b8" strokeWidth={1} />
        <line x1={M} y1={8} x2={M} y2={H - M} stroke="#94a3b8" strokeWidth={1} />
        <text x={W - 12} y={H - M + 16} fontSize={10} fill="#64748b" textAnchor="end">
          I (A)
        </text>
        <text x={M - 4} y={14} fontSize={10} fill="#64748b" textAnchor="end">
          U (V)
        </text>
        <text x={M} y={H - M + 16} fontSize={10} fill="#64748b">0</text>
        <polyline points={poly} fill="none" stroke="#2563eb" strokeWidth={2} />
      </svg>
    );
  }

  const onCsv = () => {
    const rows: (string | number)[][] = [['t', 'U_V', 'I_A']];
    for (const p of chart) rows.push([p.t, Number(p.v.toFixed(4)), Number(p.i.toFixed(4))]);
    downloadCsv(rows, 'ui_curve.csv');
  };

  return (
    <div className="panel chart">
      <div className="panel-title">
        U–I 曲线
        <span className="panel-actions">
          <button type="button" className="btn tiny" onClick={onCsv} disabled={chart.length === 0}>
            CSV
          </button>
          <button type="button" className="btn tiny" onClick={clearChart} disabled={chart.length === 0}>
            清空
          </button>
        </span>
      </div>
      {body}
      <div className="chart-note">横轴电流 I，纵轴电压 U；共 {chart.length} 个采样点。</div>
    </div>
  );
}
