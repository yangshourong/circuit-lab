import type { ComponentReading, PlacedComponent } from '../types';
import { parseRangeMax } from '../geometry';
import { METER_ARC_CENTER } from '../assets/components/art';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface MeterProps {
  comp: PlacedComponent;
  reading?: ComponentReading;
}

/**
 * Live meter dial: red needle positioned by the measured value, with
 * counterweight and pivot cap. Arc center is at viewBox (60,CY) where
 * CY=67 → world (0,-3); arc radius is 33, needle length 31.
 */
export function MeterDial({ comp, reading }: MeterProps) {
  const value = reading?.measured ?? reading?.current ?? 0;
  const rm = parseRangeMax(
    String(comp.params.range ?? ''),
    comp.type === 'ammeter' ? 3 : 15
  );
  const n = rm > 0 ? value / rm : 0;
  const angleDeg =
    comp.type === 'galvanometer' ? clamp(n, -1, 1) * 90 : -135 + clamp(n, 0, 1.1) * 270;
  const rad = (angleDeg * Math.PI) / 180;
  // viewBox (60, CY) with container y=-70 → world y = CY - 70
  const cx = 0;
  const cy = METER_ARC_CENTER.cy - 70;  // 67 - 70 = -3
  const L = 31;       // arc radius 33, 2px gap before ticks
  const nx = cx + Math.sin(rad) * L;
  const ny = cy - Math.cos(rad) * L;
  // Counterweight (opposite direction, shorter)
  const cwx = cx - Math.sin(rad) * 12;
  const cwy = cy + Math.cos(rad) * 12;
  return (
    <g pointerEvents="none">
      {/* Counterweight (dark, behind pivot) */}
      <line x1={cx} y1={cy} x2={cwx} y2={cwy} stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
      {/* Main needle (red) */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" />
      {/* Pivot cap */}
      <circle cx={cx} cy={cy} r="3.5" fill="#1e293b" />
      <circle cx={cx} cy={cy} r="1.5" fill="#64748b" />
    </g>
  );
}
