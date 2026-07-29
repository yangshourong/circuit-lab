import { memo } from 'react';
import type { ComponentDef, ComponentReading, PinRef, PlacedComponent, ViewMode } from '../types';
import { COMPONENT_ART } from '../assets/components/art';
import { fmt } from '../geometry';
import { PIN_OFFSET } from '../store';
import { MeterDial } from './Meter';
import { useStore } from '../store';

interface Props {
  comp: PlacedComponent;
  def: ComponentDef;
  selected: boolean;
  reading?: ComponentReading;
  mode: ViewMode;
  largeScreen: boolean;
  /** True when the wire tool is active — pins glow as connection targets. */
  wiring?: boolean;
  /** The armed first endpoint of a pending wire, if any. */
  wireStart?: PinRef | null;
}

function bodyReadingLabel(type: string, comp: PlacedComponent, reading?: ComponentReading): string {
  if (type === 'switch') return comp.closed === false ? '断开' : '闭合';
  if (type === 'battery') return reading ? `I=${fmt(reading.current)}A` : '';
  if (type === 'wire' || type === 'annotation' || type === 'readingLabel') return '';
  if (type === 'ammeter' || type === 'voltmeter' || type === 'galvanometer') {
    return reading ? `${fmt(reading.measured)} ${type === 'voltmeter' ? 'V' : 'A'}` : '';
  }
  const parts: string[] = [];
  if (reading?.voltage != null) parts.push(`U=${fmt(reading.voltage)}V`);
  if (reading?.current != null) parts.push(`I=${fmt(reading.current)}A`);
  if (reading?.power != null) parts.push(`P=${fmt(reading.power, 3)}W`);
  return parts.join('  ');
}

/**
  * 开关刀闸动态渲染（仅实物图模式）。
  * 刀闸铰链在右支座转轴 (85, 32)，触点在左支座卡槽 (35, 32)。
  * 闭合时刀闸水平搭接；断开时向上翘起约 55°。
  */
function SwitchBlade({ closed }: { closed: boolean }) {
  // 铰链轴位置（右支座转轴，art 本地坐标）
  const px = 85, py = 32;
  // 触点位置（左支座卡槽）
  const cx = 35, cy = 32;
  // 断开时刀闸末端抬升
  const ex = closed ? cx : 38;
  const ey = closed ? cy : 16;

  return (
    <g pointerEvents="none">
      {/* 刀闸金属柄 */}
      <line
        x1={px} y1={py} x2={ex} y2={ey}
        stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round"
      />
      <line
        x1={px} y1={py} x2={ex} y2={ey}
        stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"
      />
      {/* 绝缘手柄套（灰蓝色圆柱） */}
      <rect x={ex - 3} y={ey - 5} width="6" height="10" rx="3" fill="#94a3b8" stroke="#64748b" strokeWidth="0.5"/>
      {/* 手柄顶部凸缘 */}
      <ellipse cx={ex} cy={ey - 5} rx="3.5" ry="1.5" fill="#94a3b8" stroke="#64748b" strokeWidth="0.3"/>
    </g>
  );
}

/**
 * 多向开关选择臂（旋转式）。
 * 轴心在 (56, 35)，触点位于右侧 (90, y)，y 坐标随档位变化。
 */
/**
 * 滑动变阻器滑片 — 位置随滑片位置参数变化。
 * 铜杆 y=24，瓷管 y=38~48，绕线区 x=25~93，滑片在 x=25~93 之间滑动。
 * sliderPosition: 0=左端(A端), 1=右端(B端)
 */
function RheostatSlider({ sliderPosition }: { sliderPosition: number }) {
  const pos = Math.max(0, Math.min(1, sliderPosition));
  // 滑片从左(A端,pos=0)到右(B端,pos=1)
  const sx = 25 + pos * 68;  // x=25~93
  return (
    <g pointerEvents="none">
      {/* 滑片金属触臂（从铜杆向下压到瓷管） */}
      <line x1={sx} y1={18} x2={sx} y2={39}
        stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1={sx} y1={18} x2={sx} y2={39}
        stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round"/>
      {/* 滑片手柄（浅蓝色U形握把） */}
      <path d={`M${sx - 5} 18 L${sx - 5} 14 Q${sx - 5} 10 ${sx - 2} 10 L${sx + 2} 10 Q${sx + 5} 10 ${sx + 5} 14 L${sx + 5} 18`}
        fill="#93c5fd" stroke="#64748b" strokeWidth="0.6"/>
      {/* 滑片底部触点（压在绕线上） */}
      <ellipse cx={sx} cy={39} rx="3" ry="1.5" fill="#e5e7eb" stroke="#94a3b8" strokeWidth="0.4"/>
    </g>
  );
}

/** 电路图模式变阻器箭头 — sliderPosition 0=最左、1=最右 */
function RheostatSliderSchematic({ sliderPosition }: { sliderPosition: number }) {
  const ratio = Math.max(0, Math.min(1, sliderPosition));
  const sx = 38 + 8 + ratio * (44 - 16); // 电阻框 x=38~82，箭头在 46~68
  return (
    <g pointerEvents="none">
      <line x1={sx} y1={12} x2={sx} y2={27} stroke="#334155" strokeWidth="2.5" strokeLinecap="round"/>
      <polygon points={`${sx - 4},21 ${sx + 4},21 ${sx},28`} fill="#334155"/>
    </g>
  );
}

/**
 * 定值电阻色环 — 根据阻值按真实4环色码标准动态渲染。
 * 第1环=十位，第2环=个位，第3环=乘数(10^n)，第4环=误差(金=5%)。
 * 电阻体 x=26~94, y=22~48; 色环分布在体上。
 */
function ResistorBands({ resistance }: { resistance: number }) {
  // ── 色码颜色表 ──
  const BAND_COLORS: Record<number, string> = {
    0: '#1e293b',  // 黑
    1: '#78350f',  // 棕
    2: '#dc2626',  // 红
    3: '#ea580c',  // 橙
    4: '#eab308',  // 黄
    5: '#16a34a',  // 绿
    6: '#2563eb',  // 蓝
    7: '#7c3aed',  // 紫
    8: '#6b7280',  // 灰
    9: '#e5e7eb',  // 白
  };
  const GOLD = '#d4a017';
  // const SILVER = '#9ca3af';

  // ── 阻值→4环编码 ──
  let d1 = 0, d2 = 0, exp = 0;
  const R = Math.max(resistance, 0.01);
  let norm = R;
  // 归一化到 10 ≤ norm < 100
  while (norm >= 100) { norm /= 10; exp++; }
  while (norm < 10)  { norm *= 10; exp--; }
  d1 = Math.floor(norm / 10);
  d2 = Math.round(norm - d1 * 10);
  if (d2 >= 10) { d2 = 0; d1 += 1; exp += 1; }
  if (d1 >= 10) { d1 = 9; d2 = 9; }

  const colors = [
    BAND_COLORS[d1] ?? '#1e293b',             // 第1环：十位
    BAND_COLORS[d2] ?? '#1e293b',             // 第2环：个位
    BAND_COLORS[Math.max(0, exp)] ?? '#1e293b', // 第3环：乘数
    GOLD,                                       // 第4环：误差5%
  ];

  // 色环位置：第1~3环在左半，第4环在右半（与实物一致）
  // 电阻体 x=39~81, y=28~42; 金属帽占 36~41 和 79~84
  const bandX = [44, 51, 58, 72];

  return (
    <g pointerEvents="none">
      {colors.map((fill, i) => (
        <rect key={i}
          x={bandX[i]} y="28" width="4" height="14" rx="0.5"
          fill={fill} opacity="0.92"
        />
      ))}
    </g>
  );
}

/**
 * 电阻箱步进拨盘（仅实物图模式）。
 * ZX21 型电阻箱：4 个步进拨盘（×1k / ×100 / ×10 / ×1），
 * 每个拨盘 0-9 档，拨盘顶部有数字窗口显示当前档位数字。
 * viewBox 130×80，中心 (65, 40)，4 旋钮间距 30px 避免刻度环重叠。
 */
function ResistanceBoxKnobs({ resistance }: { resistance: number }) {
  const R = Math.max(0, Math.min(9999, Math.round(resistance)));
  const d1 = Math.floor(R / 1000);
  const d2 = Math.floor((R % 1000) / 100);
  const d3 = Math.floor((R % 100) / 10);
  const d4 = R % 10;
  const digits = [d1, d2, d3, d4];
  const labels = ['×1k', '×100', '×10', '×1'];
  // 4 旋钮均匀分布：x=20,50,80,110 间距 30px，数字环半径 ~13 不重叠
  const knobXs = [20, 50, 80, 110];
  const knobY = 36;
  const knobR = 10;

  return (
    <g pointerEvents="none">
      {/* ── 4 个步进拨盘 ── */}
      {digits.map((d, i) => {
        const cx = knobXs[i];
        // 指针角度：0 在 12 点钟方向（−90°），每档 36°
        const angleDeg = -90 + d * 36;
        const angleRad = (angleDeg * Math.PI) / 180;
        const px = cx + (knobR - 2.5) * Math.cos(angleRad);
        const py = knobY + (knobR - 2.5) * Math.sin(angleRad);

        return (
          <g key={i}>
            {/* 旋钮外圈 */}
            <circle cx={cx} cy={knobY} r={knobR}
              fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5"/>
            {/* 旋钮内圈 */}
            <circle cx={cx} cy={knobY} r={knobR - 2.5}
              fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.3"/>
            {/* 数字窗口（12 点方向上方，远离刻度环避免遮挡） */}
            <rect x={cx - 4} y={knobY - knobR - 12} width="8" height="5.5" rx="1"
              fill="#1e293b" stroke="#475569" strokeWidth="0.3"/>
            <text x={cx} y={knobY - knobR - 7.7}
              fontFamily="monospace" fontSize="3.5" fill="#22d3ee"
              textAnchor="middle" fontWeight="bold">
              {d}
            </text>
            {/* 0-9 数字环（在旋钮外侧） */}
            {Array.from({ length: 10 }, (_, n) => {
              const ta = ((-90 + n * 36) * Math.PI) / 180;
              const tx = cx + (knobR + 3.5) * Math.cos(ta);
              const ty = knobY + (knobR + 3.5) * Math.sin(ta);
              return (
                <text key={n} x={tx} y={ty + 1.2}
                  fontFamily="sans-serif" fontSize="2.5"
                  fill={n === d ? '#dc2626' : '#64748b'}
                  textAnchor="middle"
                  fontWeight={n === d ? 'bold' : 'normal'}>
                  {n}
                </text>
              );
            })}
            {/* 指针线（从中心指向当前档位） */}
            <line x1={cx} y1={knobY} x2={px} y2={py}
              stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round"/>
            {/* 中心点 */}
            <circle cx={cx} cy={knobY} r="1.5" fill="#94a3b8" stroke="#64748b" strokeWidth="0.3"/>
            {/* 倍率标签（旋钮下方，留足够间距避免遮挡底部刻度数字） */}
            <text x={cx} y={knobY + knobR + 10}
              fontFamily="sans-serif" fontSize="2.8" fill="#475569"
              textAnchor="middle" fontWeight="bold">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * 电源 LED 数显（仅实物图模式）。
 * 显示当前电源电压值，模拟真实学生电源的数码管显示。
 * viewBox 120×90，数显窗口在 (30,24)~(90,40) 区域。
 */
function BatteryDisplay({ voltage }: { voltage: number }) {
  const v = Math.max(0, Math.min(99.9, voltage));
  const vStr = v < 10 ? v.toFixed(1) : String(Math.round(v * 10) / 10);

  return (
    <g pointerEvents="none">
      <text x="60" y="37" fontFamily="monospace" fontSize="9" fill="#22d3ee"
        textAnchor="middle" fontWeight="bold">
        {vStr}V
      </text>
    </g>
  );
}

function MultiSwitchWiper({ position }: { position: number }) {
  // COM转轴位置（俯视 art 本地坐标）
  const cx = 18, cy = 35;
  // 4个档位触点位置（沿弧线排列，半径35，以COM为圆心，间隔紧凑）
  const targets = [
    { x: 50, y: 20 },  // 档位1  (−25°)
    { x: 53, y: 30 },  // 档位2  (−8°)
    { x: 53, y: 40 },  // 档位3  (+8°)
    { x: 50, y: 50 },  // 档位4  (+25°)
  ];
  // position=0 (断开) 时不显示选择臂
  if (position === 0) return null;
  const t = targets[Math.min(position - 1, 3)];

  return (
    <g pointerEvents="none">
      {/* 选择臂金属柄（宽底细顶，模拟扁金属条俯视） */}
      <line x1={cx} y1={cy} x2={t.x} y2={t.y}
        stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={t.x} y2={t.y}
        stroke="#b0b8c4" strokeWidth="2.5" strokeLinecap="round" />
      {/* 手柄（俯视圆形旋钮） */}
      <circle cx={t.x} cy={t.y} r="4.5" fill="#64748b" stroke="#475569" strokeWidth="0.6"/>
      <circle cx={t.x} cy={t.y} r="2.5" fill="#94a3b8" stroke="#64748b" strokeWidth="0.4"/>
    </g>
  );
}

/**
 * LED 发光效果（仅实物图模式）。
 * 正向导通时发红光。
 */
function LedGlow({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <g pointerEvents="none">
      {/* 外层红色光晕 */}
      <circle cx={60} cy={24} r={22} fill="rgba(220, 38, 38, 0.2)" />
      {/* 内层亮光 */}
      <circle cx={60} cy={24} r={12} fill="rgba(254, 202, 202, 0.35)" />
      {/* 中心强光 */}
      <circle cx={60} cy={24} r={6} fill="rgba(255, 255, 255, 0.4)" />
    </g>
  );
}

/**
 * 灯泡发光效果（仅实物图模式）。
 * 根据实际功率与额定功率的比值计算亮度，叠加径向渐变光晕。
 * powerRatio = min(1, P_actual / P_rated)，0 = 不亮，1 = 最亮。
 */
function LampGlow({ powerRatio }: { powerRatio: number }) {
  if (powerRatio <= 0.01) return null;

  const opacity = Math.min(1, powerRatio);
  // 灯泡玻璃中心约 (60, 18) 在 art 本地坐标
  const cx = 60, cy = 18;
  // 光晕半径随亮度略微增大
  const r = 16 + powerRatio * 10;

  return (
    <g pointerEvents="none">
      {/* 外层漫射光晕 */}
      <circle
        cx={cx} cy={cy} r={r}
        fill={`rgba(250, 204, 21, ${opacity * 0.25})`}
      />
      {/* 中层暖光 */}
      <circle
        cx={cx} cy={cy} r={r * 0.65}
        fill={`rgba(251, 191, 36, ${opacity * 0.4})`}
      />
      {/* 内层核心亮斑 */}
      <circle
        cx={cx} cy={cy} r={r * 0.35}
        fill={`rgba(254, 240, 138, ${opacity * 0.6})`}
      />
      {/* 玻璃泡内部泛黄（模拟钨丝发热） */}
      {opacity > 0.3 && (
        <circle
          cx={cx} cy={cy} r="12"
          fill={`rgba(255, 247, 200, ${opacity * 0.35})`}
        />
      )}
    </g>
  );
}

/**
 * 读数标签：实时显示附近元件的电压/电流/功率。
 * 独立订阅 store，不受 memo 影响。
 */
function ReadingLabelDisplay({ comp }: { comp: PlacedComponent }) {
  const graph = useStore((s) => s.graph);
  const solver = useStore((s) => s.solver);
  const quantity = String(comp.params.quantity ?? 'voltage');

  // 找最近的电气元件
  let nearest: PlacedComponent | null = null;
  let bestD = Infinity;
  for (const c of graph.components) {
    if (c.id === comp.id || c.type === 'annotation' || c.type === 'readingLabel' || c.type === 'wire') continue;
    const d = Math.hypot(c.x - comp.x, c.y - comp.y);
    if (d < bestD) { bestD = d; nearest = c; }
  }
  if (!nearest || bestD > 200 || !solver?.ok || !solver.readings[nearest.id]) {
    return (
      <text x={0} y={5} textAnchor="middle" fontFamily="monospace" fontSize={13} fill="#64748b" pointerEvents="none">
        ···
      </text>
    );
  }

  const r = solver.readings[nearest.id];
  const allMode = quantity === 'all';
  const lines: string[] = [];
  if (quantity === 'voltage' || allMode) lines.push(`U=${fmt(r.voltage)}V`);
  if (quantity === 'current' || allMode) lines.push(`I=${fmt(r.current)}A`);
  if (quantity === 'power' || allMode) lines.push(`P=${fmt(r.power, 3)}W`);

  // 多行显示时动态计算尺寸
  const lineH = 18;
  const padY = 6;
  const h = lines.length * lineH + padY * 2;
  const w = 95;
  const startY = -h / 2;
  const textBaseY = startY + padY + lineH * 0.75;

  return (
    <g pointerEvents="none">
      <rect x={-w / 2} y={startY} width={w} height={h} rx={4} fill="#1e293b" opacity="0.92" />
      {lines.map((line, i) => (
        <text key={i} x={0} y={textBaseY + i * lineH} textAnchor="middle" fontFamily="monospace" fontSize={12} fill="#22d3ee" fontWeight="bold">
          {line}
        </text>
      ))}
    </g>
  );
}

function ComponentViewImpl({ comp, def, selected, reading, mode, largeScreen, wiring, wireStart }: Props) {
  const art = COMPONENT_ART[comp.type]?.[mode] ?? '';
  const fault = comp.fault ?? 'normal';
  const labelText = bodyReadingLabel(comp.type, comp, reading);
  const hasPins = def.pins.length > 0;
  const isMeter = comp.type === 'ammeter' || comp.type === 'voltmeter' || comp.type === 'galvanometer';
  const isLamp = comp.type === 'lamp';
  const isSwitch = comp.type === 'switch';
  const isMultiSwitch = comp.type === 'multiSwitch';
  const isRheostat = comp.type === 'rheostat';
  const isResistor = comp.type === 'resistor' || comp.type === 'fuse' || comp.type === 'led';
  const isResistanceBox = comp.type === 'resistanceBox';
  const isBattery = comp.type === 'battery';
  const showReadings = useStore((s) => s.showReadings);

  // Meter-specific body dimensions (taller body, same width)
  // Non-meter: body spans y -35..+35 (height 70)
  // Meter: body spans y -70..+70 (height 140)
  // ResistanceBox: body spans y -40..+40 (height 80, wider 130)
  // Battery: body spans y -45..+45 (height 90)
  const meterBodyTop = isMeter ? -70 : (isResistanceBox ? -40 : (isBattery ? -45 : -35));
  const meterBodyH = isMeter ? 140 : (isResistanceBox ? 80 : (isBattery ? 90 : 70));
  // Selection / fault box: 7px padding around body
  const boxY = meterBodyTop - 7;
  const boxH = meterBodyH + 14;

  const labelFontSize = largeScreen ? 22 : 13;

  // 计算灯泡功率比（用于亮度）
  let lampPowerRatio = 0;
  if (comp.type === 'lamp' && reading?.power != null) {
    const Pr = Number(comp.params.ratedPower ?? def.defaults?.ratedPower ?? 0.5); // 默认额定功率 0.5W
    if (Pr > 0) lampPowerRatio = Math.abs(reading.power) / Pr;
  }

  return (
    <g
      transform={`translate(${comp.x} ${comp.y}) rotate(${comp.rotation ?? 0})`}
      data-comp={comp.id}
      style={{ cursor: 'move' }}
    >
      {/* selection highlight */}
      {selected && (
        <rect
          x={isResistanceBox ? -71 : -66}
          y={boxY}
          width={isResistanceBox ? 142 : 132}
          height={boxH}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
          strokeDasharray="6 4"
          rx={6}
          pointerEvents="none"
        />
      )}

      {/* body art */}
      <svg
        x={isResistanceBox ? -65 : -60}
        y={meterBodyTop}
        width={isResistanceBox ? 130 : 120}
        height={meterBodyH}
        viewBox={isResistanceBox ? "0 0 130 80" : (isBattery ? "0 0 120 90" : (isMeter ? "0 0 120 140" : "0 0 120 70"))}
        overflow="visible"
      >
        <defs>
          <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="30%" stopColor="#f8fafc"/>
            <stop offset="60%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#475569"/>
          </linearGradient>
          <linearGradient id="metalH" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#475569"/>
            <stop offset="30%" stopColor="#e2e8f0"/>
            <stop offset="60%" stopColor="#f8fafc"/>
            <stop offset="100%" stopColor="#64748b"/>
          </linearGradient>
          <linearGradient id="cylinder" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef08a"/>
            <stop offset="25%" stopColor="#fef9c3"/>
            <stop offset="50%" stopColor="#fde047"/>
            <stop offset="85%" stopColor="#b45309"/>
            <stop offset="100%" stopColor="#78350f"/>
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)"/>
            <stop offset="50%" stopColor="rgba(255,255,255,0.1)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0.3)"/>
          </linearGradient>
          <linearGradient id="plastic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f1f5f9"/>
            <stop offset="40%" stopColor="#e2e8f0"/>
            <stop offset="100%" stopColor="#cbd5e1"/>
          </linearGradient>
          <linearGradient id="ceramic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fefce8"/>
            <stop offset="50%" stopColor="#f5f5dc"/>
            <stop offset="100%" stopColor="#d6d3d1"/>
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="rgba(0,0,0,0.25)"/>
          </filter>
          <filter id="shadowSm" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.2)"/>
          </filter>
        </defs>
        <g dangerouslySetInnerHTML={{ __html: art }} />

        {/* ═══ 动态状态叠加层（仅 physical 模式） ═══ */}

        {/* 定值电阻：色环随阻值变化 */}
        {mode === 'physical' && comp.type === 'resistor' && (
          <ResistorBands resistance={Number(comp.params.resistance ?? 10)} />
        )}

        {/* 电阻箱：旋钮+读数窗随阻值变化 */}
        {mode === 'physical' && isResistanceBox && (
          <ResistanceBoxKnobs resistance={Number(comp.params.resistance ?? 10)} />
        )}

        {/* 电源：LED数显随电压变化 */}
        {mode === 'physical' && isBattery && (
          <BatteryDisplay voltage={Number(comp.params.voltage ?? 3)} />
        )}

        {/* 开关：刀闸位置随开合状态变化 */}
        {mode === 'physical' && comp.type === 'switch' && (
          <SwitchBlade closed={comp.closed !== false} />
        )}

        {/* 多向开关：选择臂指向当前档位 */}
        {mode === 'physical' && comp.type === 'multiSwitch' && (
          <MultiSwitchWiper position={Number(comp.params.position ?? 1)} />
        )}

        {/* 滑动变阻器：滑片位置随参数变化 */}
        {mode === 'physical' && comp.type === 'rheostat' && (
          <RheostatSlider sliderPosition={Number(comp.params.sliderPosition ?? 0.5)} />
        )}
        {mode === 'schematic' && comp.type === 'rheostat' && (
          <RheostatSliderSchematic sliderPosition={Number(comp.params.sliderPosition ?? 0.5)} />
        )}

        {/* 灯泡：光晕随实际功率变化 */}
        {mode === 'physical' && comp.type === 'lamp' && (
          <LampGlow powerRatio={lampPowerRatio} />
        )}

        {/* LED：正向导通时发红光 */}
        {mode === 'physical' && comp.type === 'led' && (
          <LedGlow on={!!reading?.current && reading.current > 0} />
        )}
      </svg>

      {/* annotation: overlay the actual text */}
      {comp.type === 'annotation' && (
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fontFamily="sans-serif"
          fontSize={largeScreen ? 26 : 14}
          fill="#334155"
          pointerEvents="none"
        >
          {String(comp.params.text ?? '注释')}
        </text>
      )}

      {/* meter live needle + digital readout（电路图模式不显示：教材原理图只有符号） */}
      {isMeter && mode !== 'schematic' && <MeterDial comp={comp} reading={reading} />}

      {/* fault indication */}
      {fault !== 'normal' && (
        <g pointerEvents="none">
          <rect
            x={isResistanceBox ? -71 : -66}
            y={boxY}
            width={isResistanceBox ? 142 : 132}
            height={boxH}
            fill="none"
            stroke="#dc2626"
            strokeWidth={2.5}
            rx={6}
          />
          <text x={0} y={boxY - 6} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#dc2626">
            {fault === 'open' ? '断路' : '短路'}
          </text>
        </g>
      )}

      {/* 保险丝过载指示 */}
      {comp.type === 'fuse' && reading?.measured === 0 && (
        <text x={0} y={-30} textAnchor="middle" fontSize={labelFontSize} fill="#dc2626" fontWeight="bold" pointerEvents="none">熔断</text>
      )}

      {/* 读数标签：显示附近元件的实时读数 */}
      {comp.type === 'readingLabel' && !wiring && (
        <ReadingLabelDisplay comp={comp} />
      )}

      {/* reading label below body（电路图模式不显示，默认隐藏标注） */}
      {labelText && mode !== 'schematic' && showReadings && (
        <text
          x={0}
          y={isMeter ? 87 : 52}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={labelFontSize}
          fill={fault !== 'normal' ? '#dc2626' : '#0f172a'}
          pointerEvents="none"
        >
          {labelText}
        </text>
      )}

      {/* component label — 自适应旋转 */}
      {comp.label && (() => {
        const rot = comp.rotation ?? 0;
        const fs = labelFontSize - 1;
        const gap = fs + 3;
        const chars = comp.label.split('');
          const isVert = rot === 90 || rot === 270;

        if (isVert) {
          // 90°/270°：竖排。父级 rotate(90°) 时，(x,y)→(-y,x)
          // 要显示在右侧 (65, i*gap)，需放置于 local (i*gap, -65)
          // 每个字单独反旋转保持正向可读
          // 宽度不变，水平偏移无需调整
          const shift = rot === 90 ? gap : -gap;
          return (
            <g pointerEvents="none">
              {chars.map((ch, i) => (
                <text key={i}
                  x={i * shift} y={-82 + (chars.length - 1) * gap / 2}
                  transform={`rotate(${-rot})`}
                  textAnchor="middle" dominantBaseline="central"
                  fontFamily="sans-serif" fontSize={fs}
                  fill="#334155" fontWeight="bold">
                  {ch}
                </text>
              ))}
            </g>
          );
        } else {
          // 0°: 上方 (0, boxY)；180°: 下方 (0, -(boxY))
          const ty = rot === 0 ? boxY : -boxY;
          return (
            <text x={0} y={ty}
              transform={`rotate(${-rot})`}
              textAnchor="middle" fontFamily="sans-serif"
              fontSize={fs} fill="#334155" fontWeight="bold" pointerEvents="none">
              {comp.label}
            </text>
          );
        }
      })()}

      {/* pin hit areas + mode-specific terminals */}
      {hasPins &&
        def.pins.map((p) => {
          const l = comp.pinPositions?.[p.id] ?? { x: p.id === 'a' ? -PIN_OFFSET : PIN_OFFSET, y: 0 };
          const armed = !!wireStart && wireStart.componentId === comp.id && wireStart.pin === p.id;

          return (
            <g key={p.id}>
              {mode === 'physical' && !isMeter && !isLamp && !isSwitch && !isMultiSwitch && !isRheostat && !isResistor && !isResistanceBox && !isBattery ? (
                /* ── 普通组件：接线柱在侧面电气引脚位置 ── */
                <>
                  {wiring && (
                    <circle cx={l.x} cy={l.y} r={armed ? 13 : 11}
                      fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                      stroke={armed ? '#16a34a' : '#2563eb'}
                      strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                  )}
                  <circle cx={l.x} cy={l.y} r={wiring ? 11 : 9}
                    fill="transparent" data-comp={comp.id} data-pin={p.id}
                    style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                  <g transform={`translate(${l.x} ${l.y})`} pointerEvents="none">
                    <circle r={9} fill={comp.flipPolarity ? (p.id === 'a' ? '#0f172a' : '#dc2626') : (p.id === 'a' ? '#dc2626' : '#0f172a')} stroke="#334155" strokeWidth={1.5} />
                    <circle r={4.2} fill="#0b1220" />
                    <circle r={1.5} fill="#1e293b" />
                  </g>
                </>
              ) : mode === 'physical' && isMeter ? (
                /* ── 仪表：底部 3 个接线柱均可点击 ──
                    pin 'b' (−) → 左侧黑色接线柱
                    pin 'a' (+) → 中间（低量程）+ 右侧（高量程）两个红色接线柱
                    无交叉走线：真实仪表内部连线不可见 */
                <>
                  {p.id === 'b' ? (
                    /* ─ 左侧负接线柱 ─ */
                    <>
                      {wiring && (
                        <circle cx={-33} cy={44} r={armed ? 13 : 11}
                          fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                          stroke={armed ? '#16a34a' : '#2563eb'}
                          strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                      )}
                      <circle cx={-33} cy={44} r={wiring ? 11 : 9}
                        fill="transparent" data-comp={comp.id} data-pin={p.id}
                        style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                    </>
                  ) : (
                    /* ─ 两个正接线柱（中间低量程 + 右侧高量程），都映射到 pin 'a' ─ */
                    <>
                      {/* 中间正接线柱（低量程） */}
                      {wiring && (
                        <circle cx={-5} cy={44} r={armed ? 13 : 11}
                          fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                          stroke={armed ? '#16a34a' : '#2563eb'}
                          strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                      )}
                      <circle cx={-5} cy={44} r={wiring ? 11 : 9}
                        fill="transparent" data-comp={comp.id} data-pin={p.id}
                        data-range="low"
                        style={{ cursor: wiring ? 'crosshair' : 'move' }} />

                      {/* 右侧正接线柱（高量程） */}
                      {wiring && (
                        <circle cx={23} cy={44} r={armed ? 13 : 11}
                          fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                          stroke={armed ? '#16a34a' : '#2563eb'}
                          strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                      )}
                      <circle cx={23} cy={44} r={wiring ? 11 : 9}
                        fill="transparent" data-comp={comp.id} data-pin={p.id}
                        data-range="high"
                        style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                    </>
                  )}
                </>
              ) : mode === 'physical' && isLamp ? (
                /* ── 灯泡：底座红色接线柱可点击连线 ──
                    pin 'a' (+) → 左侧接线柱 (-33, 16)
                    pin 'b' (−) → 右侧接线柱 (33, 16) */
                <>
                  {(() => {
                    const tx = p.id === 'a' ? -33 : 33;
                    const ty = 16;
                    return (
                      <>
                        {wiring && (
                          <circle cx={tx} cy={ty} r={armed ? 13 : 11}
                            fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                            stroke={armed ? '#16a34a' : '#2563eb'}
                            strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                        )}
                        <circle cx={tx} cy={ty} r={wiring ? 11 : 9}
                          fill="transparent" data-comp={comp.id} data-pin={p.id}
                          style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                      </>
                    );
                  })()}
                </>
              ) : mode === 'physical' && isSwitch ? (
                /* ── 开关：底座红色接线柱可点击连线 ──
                    pin 'a' (+) → 左侧接线柱 (-33, 16)
                    pin 'b' (−) → 右侧接线柱 (33, 16) */
                <>
                  {(() => {
                    const tx = p.id === 'a' ? -33 : 33;
                    const ty = 16;
                    return (
                      <>
                        {wiring && (
                          <circle cx={tx} cy={ty} r={armed ? 13 : 11}
                            fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                            stroke={armed ? '#16a34a' : '#2563eb'}
                            strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                        )}
                        <circle cx={tx} cy={ty} r={wiring ? 11 : 9}
                          fill="transparent" data-comp={comp.id} data-pin={p.id}
                          style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                      </>
                    );
                  })()}
                </>
              ) : mode === 'physical' && isMultiSwitch ? (
                /* ── 多向开关：底座接线柱可点击连线（俯视布局） ──
                    pin 'a' (COM) → (-48, 23)   左下黑色接线柱
                    pin 'b' (1) → (43, -17.5)   右上红色接线柱
                    pin 'c' (2) → (43, -6.5)
                    pin 'd' (3) → (43, 4.5)
                    pin 'e' (4) → (43, 15.5)    右下红色接线柱 */
                <>
                  {(() => {
                    const posMap: Record<string, { x: number; y: number }> = {
                      a: { x: -48, y: 23 },
                      b: { x: 43, y: -17.5 },
                      c: { x: 43, y: -6.5 },
                      d: { x: 43, y: 4.5 },
                      e: { x: 43, y: 15.5 },
                    };
                    const t = posMap[p.id] ?? { x: l.x, y: l.y };
                    return (
                      <>
                        {wiring && (
                          <circle cx={t.x} cy={t.y} r={armed ? 13 : 11}
                            fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                            stroke={armed ? '#16a34a' : '#2563eb'}
                            strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                        )}
                        <circle cx={t.x} cy={t.y} r={wiring ? 11 : 9}
                          fill="transparent" data-comp={comp.id} data-pin={p.id}
                          style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                      </>
                    );
                  })()}
                </>
              ) : mode === 'physical' && isResistor ? (
                /* ── 定值电阻：底座红色接线柱可点击连线 ──
                     pin 'a' (A) → 左侧接线柱 (-33, 9)
                     pin 'b' (B) → 右侧接线柱 (33, 9) */
                <>
                  {(() => {
                    const tx = p.id === 'a' ? -33 : 33;
                    const ty = 9;
                    return (
                      <>
                        {wiring && (
                          <circle cx={tx} cy={ty} r={armed ? 13 : 11}
                            fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                            stroke={armed ? '#16a34a' : '#2563eb'}
                            strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                        )}
                        <circle cx={tx} cy={ty} r={wiring ? 11 : 9}
                          fill="transparent" data-comp={comp.id} data-pin={p.id}
                          style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                      </>
                    );
                  })()}
                </>
              ) : mode === 'physical' && isResistanceBox ? (
                /* ── 电阻箱：箱体面板底部接线柱可点击连线 ──
                     pin 'a' (A) → 左侧接线柱 (-40, 22)
                     pin 'b' (B) → 右侧接线柱 (40, 22) */
                <>
                  {(() => {
                    const tx = p.id === 'a' ? -40 : 40;
                    const ty = 22;
                    return (
                      <>
                        {wiring && (
                          <circle cx={tx} cy={ty} r={armed ? 13 : 11}
                            fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                            stroke={armed ? '#16a34a' : '#2563eb'}
                            strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                        )}
                        <circle cx={tx} cy={ty} r={wiring ? 11 : 9}
                          fill="transparent" data-comp={comp.id} data-pin={p.id}
                          style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                      </>
                    );
                  })()}
                </>
              ) : mode === 'physical' && isBattery ? (
                /* ── 电源：顶盖两端接线柱可点击连线 ──
                     pin 'a' (+) → 右侧红色接线柱 (35, -31)
                     pin 'b' (−) → 左侧银色接线柱 (-35, -31) */
                <>
                  {(() => {
                    const tx = p.id === 'a' ? 35 : -35;
                    const ty = -31;
                    return (
                      <>
                        {wiring && (
                          <circle cx={tx} cy={ty} r={armed ? 13 : 11}
                            fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                            stroke={armed ? '#16a34a' : '#2563eb'}
                            strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                        )}
                        <circle cx={tx} cy={ty} r={wiring ? 11 : 9}
                          fill="transparent" data-comp={comp.id} data-pin={p.id}
                          style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                      </>
                    );
                  })()}
                </>
              ) : mode === 'physical' && isRheostat ? (
                /* ── 滑动变阻器：4端接线柱可点击连线 ──
                     A (pin 'a') → 左下接线柱 (-48, 17)
                     B (pin 'b') → 右下接线柱 (48, 17)
                     C (pin 'c') → 左上接线柱 (-48, -17)
                     D (pin 'd') → 右上接线柱 (48, -17) */
                <>
                  {(() => {
                    const posMap: Record<string, { x: number; y: number }> = {
                      a: { x: -48, y: 17 },
                      b: { x: 48, y: 17 },
                      c: { x: -48, y: -17 },
                      d: { x: 48, y: -17 },
                    };
                    const t = posMap[p.id] ?? { x: l.x, y: l.y };
                    return (
                      <>
                        {wiring && (
                          <circle cx={t.x} cy={t.y} r={armed ? 13 : 11}
                            fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                            stroke={armed ? '#16a34a' : '#2563eb'}
                            strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                        )}
                        <circle cx={t.x} cy={t.y} r={wiring ? 11 : 9}
                          fill="transparent" data-comp={comp.id} data-pin={p.id}
                          style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                      </>
                    );
                  })()}
                </>
              ) : (
                /* ── 电路图模式：标准连接节点 ── */
                <>
                  {wiring && (
                    <circle cx={l.x} cy={l.y} r={armed ? 13 : 11}
                      fill={armed ? 'rgba(22,163,74,0.22)' : 'rgba(37,99,235,0.16)'}
                      stroke={armed ? '#16a34a' : '#2563eb'}
                      strokeWidth={armed ? 2.5 : 1.5} pointerEvents="none" />
                  )}
                  <circle cx={l.x} cy={l.y} r={wiring ? 11 : 9}
                    fill="transparent" data-comp={comp.id} data-pin={p.id}
                    style={{ cursor: wiring ? 'crosshair' : 'move' }} />
                  <circle cx={l.x} cy={l.y} r={3} fill="#1e293b" pointerEvents="none" />
                </>
              )}
            </g>
          );
        })}
    </g>
  );
}

export const ComponentView = memo(ComponentViewImpl);
