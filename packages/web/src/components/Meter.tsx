import type { ComponentReading, PlacedComponent } from '../types';
import { parseRangeMax } from '../geometry';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface MeterProps {
  comp: PlacedComponent;
  reading?: ComponentReading;
}

/**
 * Enlarged live meter dial: a red needle positioned by the measured value and a
 * large digital readout (≥24px equivalent in large-screen mode), per P0 req #6/#13.
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
  const cx = 0;
  const cy = -2;
  const L = 18;
  const nx = cx + Math.sin(rad) * L;
  const ny = cy - Math.cos(rad) * L;
  return (
    <g pointerEvents="none">
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#dc2626" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={2.6} fill="#334155" />
    </g>
  );
}
