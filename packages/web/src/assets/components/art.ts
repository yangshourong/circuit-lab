// 智能电路实验室 — v2 拟真元器件矢量素材
// 所有内容均为 120×70 视框内的「内部 SVG」(不含 <svg> 包裹)，
// 由 web 端通过 dangerouslySetInnerHTML 注入。
// 左/右两个连接引脚固定在 (8,35) 与 (112,35)，须对齐 PIN_HALF = 52。
// 例外：电表（电流表/电压表/电流计）的 physical 模式使用 120×140 视框，
// 引脚在 (8,70) 与 (112,70)，弧线中心 (60,67)、半径 33。
//
// Shared gradients & filters are defined in ComponentView.tsx <defs>:
//   metal, metalH, cylinder, glass, plastic, ceramic, shadow, shadowSm
//
// 实物图（physical）原则：拟真质感，带底座/接线柱，状态动态叠加。
// 原理图（schematic）：人教版教材标准符号。

export interface ComponentArt {
  physical: string;
  schematic: string;
}

// ─────────────────────────────────────────────────────────────────────
// 仪表物理视图辅助函数
// 生成弧线刻度、数字、接线柱等公共部分
// 弧心 (60,67)，半径 33，刻度线从 y=34 开始
// ─────────────────────────────────────────────────────────────────────

/** 生成小刻度线（每9°一条，跳过主刻度和次刻度位置） */
function minorTicks(cx: number, cy: number, excludeAngles: number[]): string {
  const lines: string[] = [];
  for (let a = -135; a <= 135; a += 9) {
    if (excludeAngles.includes(a)) continue;
    lines.push(`  <g transform="rotate(${a} ${cx} ${cy})"><line x1="${cx}" y1="${cy - 33}" x2="${cx}" y2="${cy - 30}"/></g>`);
  }
  return `<g stroke="#64748b" stroke-width="0.6" stroke-linecap="round">\n${lines.join('\n')}\n</g>`;
}

/** 生成主刻度线（0.25量程间隔） */
function majorTicks(cx: number, cy: number, angles: number[]): string {
  const lines = angles.map(a =>
    `  <g transform="rotate(${a} ${cx} ${cy})"><line x1="${cx}" y1="${cy - 33}" x2="${cx}" y2="${cy - 27}"/></g>`
  );
  return `<g stroke="#334155" stroke-width="1" stroke-linecap="round">\n${lines.join('\n')}\n</g>`;
}

/** 生成最大刻度线（0.5量程间隔） */
function maxTicks(cx: number, cy: number, angles: number[]): string {
  const lines = angles.map(a =>
    `  <g transform="rotate(${a} ${cx} ${cy})"><line x1="${cx}" y1="${cy - 33}" x2="${cx}" y2="${cy - 25}"/></g>`
  );
  return `<g stroke="#0f172a" stroke-width="1.5" stroke-linecap="round">\n${lines.join('\n')}\n</g>`;
}

/** 生成270°弧线仪表的刻度盘SVG片段（电流表/电压表通用）
 *  outerValues / innerValues: 实际刻度值数组，函数自动计算对应角度
 *  outerMax / innerMax: 各量程最大值，用于将刻度值映射到角度
 */
function meter270Dial(
  cx: number, cy: number,
  outerValues: number[], outerMax: number,
  innerValues: number[], innerMax: number,
  unit: string, gradeLabel: string,
): string {
  const R = 33;
  const Ri = 30;
  const ax = cx - R * 0.7071;
  const ay = cy + R * 0.7071;
  const bx = cx + R * 0.7071;
  const by = cy + R * 0.7071;
  const aix = cx - Ri * 0.7071;
  const aiy = cy + Ri * 0.7071;
  const bix = cx + Ri * 0.7071;
  const biy = cy + Ri * 0.7071;
  // 红色警示区：从 0° 到 +45° 的弧段（满量程附近过载区域）
  const dangerStartX = cx + R;           // 0° 弧线点
  const dangerStartY = cy;
  const dangerEndX = bx;                 // +45° 弧线点
  const dangerEndY = by;

  const maxAngles = [-135, -45, 45, 135];
  const majorAngles = [-90, 0, 90];
  const allExclude = [...maxAngles, ...majorAngles];

  const scaleR = 40;   // 外圈数字在弧线外侧 (R=33)
  const scaleRi = 25;  // 内圈数字在弧线内侧

  // 根据 value/max 将刻度值映射到弧线角度 (-135° ~ +135°)
  // 主刻度（整数位/量程端点）用较大粗体，副刻度（中间值）用稍小字号
  let outerTexts = '';
  outerValues.forEach(v => {
    const angle = -135 + (v / outerMax) * 270;
    const a = angle * Math.PI / 180;
    const x = cx + scaleR * Math.sin(a);
    const y = cy - scaleR * Math.cos(a);
    const isMajor = (v === 0 || v === outerMax || Number.isInteger(v));
    const fs = isMajor ? 6 : 4.8;
    outerTexts += `  <text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${fs}">${v}</text>\n`;
  });
  let innerTexts = '';
  innerValues.forEach(v => {
    const angle = -135 + (v / innerMax) * 270;
    const a = angle * Math.PI / 180;
    const x = cx + scaleRi * Math.sin(a);
    const y = cy - scaleRi * Math.cos(a);
    innerTexts += `  <text x="${x.toFixed(2)}" y="${y.toFixed(2)}">${v}</text>\n`;
  });

  return `<rect x="17" y="18" width="86" height="80" rx="4" fill="#fafafa" stroke="#94a3b8" stroke-width="0.8"/>
<rect x="18" y="19" width="84" height="78" rx="3" fill="none" stroke="#cbd5e1" stroke-width="0.4" opacity="0.5"/>
<path d="M ${ax.toFixed(2)} ${ay.toFixed(2)} A ${R} ${R} 0 1 1 ${bx.toFixed(2)} ${by.toFixed(2)}" fill="none" stroke="#e2e8f0" stroke-width="7" stroke-linecap="round"/>
<path d="M ${dangerStartX.toFixed(2)} ${dangerStartY.toFixed(2)} A ${R} ${R} 0 0 1 ${dangerEndX.toFixed(2)} ${dangerEndY.toFixed(2)}" fill="none" stroke="#ef4444" stroke-width="7" stroke-linecap="round" opacity="0.35"/>
<path d="M ${ax.toFixed(2)} ${ay.toFixed(2)} A ${R} ${R} 0 1 1 ${bx.toFixed(2)} ${by.toFixed(2)}" fill="none" stroke="#0f172a" stroke-width="1"/>
<path d="M ${aix.toFixed(2)} ${aiy.toFixed(2)} A ${Ri} ${Ri} 0 1 1 ${bix.toFixed(2)} ${biy.toFixed(2)}" fill="none" stroke="#94a3b8" stroke-width="0.6" opacity="0.4"/>
${minorTicks(cx, cy, allExclude)}
${majorTicks(cx, cy, majorAngles)}
${maxTicks(cx, cy, maxAngles)}
  <g font-family="sans-serif" font-size="6" fill="#0f172a" text-anchor="middle" dominant-baseline="central" font-weight="bold">
${outerTexts}</g>
  <g font-family="sans-serif" font-size="4.5" fill="#64748b" text-anchor="middle" dominant-baseline="central">
${innerTexts}</g>
<text x="${cx}" y="${cy}" font-family="sans-serif" font-size="8" fill="#dc2626" text-anchor="middle" font-weight="bold">${unit}</text>
<text x="${cx}" y="${cy + 30}" font-family="sans-serif" font-size="3" fill="#64748b" text-anchor="middle">${gradeLabel}</text>
<path d="M17 18 Q60 15 103 18 L103 25 Q60 22 17 25Z" fill="white" opacity="0.12"/>`;
}

/** 生成底部接线柱SVG片段 */
function meterTerminals(t1Label: string, t1Sub: string, t2Label: string, t2Sub: string): string {
  return `<rect x="22" y="110" width="10" height="8" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="0.5"/>
<text x="27" y="115.5" font-family="sans-serif" font-size="5" fill="white" text-anchor="middle" font-weight="bold">${t1Label}</text>
<rect x="50" y="110" width="10" height="8" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="0.5"/>
<text x="55" y="115.5" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">${t2Label}</text>
<rect x="78" y="110" width="10" height="8" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="0.5"/>
<text x="83" y="115.5" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">3</text>
<text x="27" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">−</text>
<text x="55" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">${t1Sub}</text>
<text x="83" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">${t2Sub}</text>
<circle cx="60" cy="130" r="2.5" fill="url(#metal)" stroke="#64748b" stroke-width="0.4"/>
<line x1="57.5" y1="130" x2="62.5" y2="130" stroke="#475569" stroke-width="0.5"/>`;
}

// ═════════════════════════════════════════════════════════════
// 弧心坐标常量（与 Meter.tsx 指针 pivot 对齐）
// ═════════════════════════════════════════════════════════════
const CX = 60;  // 弧心 x
const CY = 63;  // 弧心 y（从67再上移4px，使刻度盘在白面板中垂直居中）

export const METER_ARC_CENTER = { cx: CX, cy: CY };

export const COMPONENT_ART: Record<string, ComponentArt> = {

  // ═════════════════════════════════════════════════════════════
  // 1. 电源 — 电池组（3D 圆柱电池 + 塑料支架）
  // ═════════════════════════════════════════════════════════════
  battery: {
    physical: `
<line x1="8" y1="35" x2="22" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="98" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 电池盒底座 -->
<rect x="20" y="34" width="80" height="18" rx="3" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<!-- 四节圆柱电池 -->
<g filter="url(#shadowSm)">
  <rect x="26" y="14" width="14" height="20" rx="3" fill="url(#cylinder)"/>
  <rect x="42" y="14" width="14" height="20" rx="3" fill="url(#cylinder)"/>
  <rect x="58" y="14" width="14" height="20" rx="3" fill="url(#cylinder)"/>
  <rect x="74" y="14" width="14" height="20" rx="3" fill="url(#cylinder)"/>
</g>
<!-- 正极凸起 -->
<g fill="#dc2626" stroke="#991b1b" stroke-width="0.6">
  <ellipse cx="33" cy="14" rx="4" ry="2"/>
  <ellipse cx="49" cy="14" rx="4" ry="2"/>
  <ellipse cx="65" cy="14" rx="4" ry="2"/>
  <ellipse cx="81" cy="14" rx="4" ry="2"/>
</g>
<!-- 负极弹簧示意 -->
<g stroke="#94a3b8" stroke-width="0.8" fill="none">
  <path d="M30 34 Q33 30 36 34"/>
  <path d="M46 34 Q49 30 52 34"/>
  <path d="M62 34 Q65 30 68 34"/>
  <path d="M78 34 Q81 30 84 34"/>
</g>
<!-- 正负极标识 -->
<text x="8" y="30" font-family="sans-serif" font-size="8" fill="#dc2626" font-weight="bold">+</text>
<text x="106" y="30" font-family="sans-serif" font-size="8" fill="#0f172a" font-weight="bold">−</text>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="35" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="85" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<rect x="35" y="22" width="16" height="26" rx="2" fill="none" stroke="#334155" stroke-width="2.5"/>
<line x1="54" y1="28" x2="54" y2="42" stroke="#334155" stroke-width="1.5"/>
<line x1="58" y1="25" x2="58" y2="45" stroke="#334155" stroke-width="2.5"/>
<line x1="62" y1="28" x2="62" y2="42" stroke="#334155" stroke-width="1.5"/>
<line x1="66" y1="25" x2="66" y2="45" stroke="#334155" stroke-width="2.5"/>
<line x1="70" y1="28" x2="70" y2="42" stroke="#334155" stroke-width="1.5"/>
<rect x="73" y="22" width="12" height="26" rx="2" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="58" font-family="sans-serif" font-size="9" fill="#334155" text-anchor="middle">E</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 2. 开关 — 刀闸开关
  // ═════════════════════════════════════════════════════════════
  switch: {
    physical: `
<line x1="8" y1="35" x2="22" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="98" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<rect x="18" y="18" width="84" height="34" rx="4" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<!-- 底座接线柱 -->
<circle cx="35" cy="27" r="4" fill="url(#metalH)" stroke="#64748b" stroke-width="1"/>
<circle cx="85" cy="27" r="4" fill="url(#metalH)" stroke="#64748b" stroke-width="1"/>
<!-- 刀闸铰链 -->
<circle cx="35" cy="27" r="2" fill="#475569"/>
<text x="60" y="46" font-family="sans-serif" font-size="6" fill="#334155" text-anchor="middle">开关</text>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="35" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="85" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="35" cy="35" r="3" fill="none" stroke="#334155" stroke-width="2"/>
<circle cx="85" cy="35" r="3" fill="none" stroke="#334155" stroke-width="2"/>
<line x1="38" y1="35" x2="82" y2="20" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
`.trim(),
  },

  // 2b. 多向开关
  multiSwitch: {
    physical: `
<rect x="15" y="15" width="90" height="40" rx="4" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<circle cx="30" cy="35" r="5" fill="url(#metalH)" stroke="#64748b" stroke-width="1"/>
<circle cx="55" cy="22" r="4" fill="url(#metalH)" stroke="#64748b" stroke-width="0.8"/>
<circle cx="70" cy="22" r="4" fill="url(#metalH)" stroke="#64748b" stroke-width="0.8"/>
<circle cx="85" cy="22" r="4" fill="url(#metalH)" stroke="#64748b" stroke-width="0.8"/>
<circle cx="100" cy="22" r="4" fill="url(#metalH)" stroke="#64748b" stroke-width="0.8"/>
<text x="30" y="48" font-family="sans-serif" font-size="5" fill="#334155" text-anchor="middle">COM</text>
<text x="55" y="17" font-family="sans-serif" font-size="5" fill="#64748b" text-anchor="middle">1</text>
<text x="70" y="17" font-family="sans-serif" font-size="5" fill="#64748b" text-anchor="middle">2</text>
<text x="85" y="17" font-family="sans-serif" font-size="5" fill="#64748b" text-anchor="middle">3</text>
<text x="100" y="17" font-family="sans-serif" font-size="5" fill="#64748b" text-anchor="middle">4</text>
`.trim(),
    schematic: `
<circle cx="20" cy="35" r="3" fill="none" stroke="#334155" stroke-width="2"/>
<circle cx="95" cy="20" r="3" fill="none" stroke="#334155" stroke-width="2"/>
<circle cx="95" cy="35" r="3" fill="none" stroke="#334155" stroke-width="2"/>
<circle cx="95" cy="50" r="3" fill="none" stroke="#334155" stroke-width="2"/>
<line x1="8" y1="35" x2="17" y2="35" stroke="#334155" stroke-width="2.5"/>
<line x1="98" y1="20" x2="112" y2="20" stroke="#334155" stroke-width="2.5"/>
<line x1="98" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5"/>
<line x1="98" y1="50" x2="112" y2="50" stroke="#334155" stroke-width="2.5"/>
<line x1="23" y1="35" x2="92" y2="20" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 3. 电灯
  // ═════════════════════════════════════════════════════════════
  lamp: {
    physical: `
<!-- 引脚到接线柱的导线 -->
<line x1="8" y1="35" x2="27" y2="51" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round"/>
<line x1="112" y1="35" x2="93" y2="51" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round"/>
<!-- 底座 -->
<rect x="18" y="53" width="84" height="12" rx="3" fill="url(#plastic)" stroke="#64748b" stroke-width="1" filter="url(#shadowSm)"/>
<rect x="19" y="54" width="82" height="3" rx="1.5" fill="white" opacity="0.08"/>
<!-- 左接线柱 -->
<rect x="22" y="47" width="10" height="8" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="0.5"/>
<rect x="23" y="47" width="8" height="3" rx="1" fill="#fca5a5" opacity="0.3"/>
<!-- 右接线柱 -->
<rect x="88" y="47" width="10" height="8" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="0.5"/>
<rect x="89" y="47" width="8" height="3" rx="1" fill="#fca5a5" opacity="0.3"/>
<!-- 灯座承托台 -->
<rect x="44" y="41" width="32" height="14" rx="5" fill="url(#plastic)" stroke="#64748b" stroke-width="0.8"/>
<rect x="45" y="42" width="30" height="3" rx="1.5" fill="white" opacity="0.08"/>
<!-- 螺口灯头 -->
<rect x="48" y="33" width="24" height="10" rx="2" fill="url(#metalH)" stroke="#94a3b8" stroke-width="0.5"/>
<line x1="48" y1="36" x2="72" y2="36" stroke="#64748b" stroke-width="0.4" opacity="0.5"/>
<line x1="48" y1="38.5" x2="72" y2="38.5" stroke="#64748b" stroke-width="0.4" opacity="0.5"/>
<line x1="48" y1="41" x2="72" y2="41" stroke="#64748b" stroke-width="0.4" opacity="0.5"/>
<!-- 玻璃泡 -->
<ellipse cx="60" cy="18" rx="18" ry="17" fill="url(#glass)" stroke="#94a3b8" stroke-width="0.8"/>
<!-- 灯丝支架 -->
<line x1="56" y1="33" x2="56" y2="20" stroke="#b45309" stroke-width="0.6"/>
<line x1="64" y1="33" x2="64" y2="20" stroke="#b45309" stroke-width="0.6"/>
<!-- 灯丝（U形） -->
<path d="M56 20 Q60 10 64 20" fill="none" stroke="#b45309" stroke-width="0.8"/>
<!-- 玻璃高光 -->
<ellipse cx="53" cy="13" rx="6" ry="4" fill="white" opacity="0.35"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="35" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="85" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="20" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="40" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">X</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 4. 定值电阻
  // ═════════════════════════════════════════════════════════════
  resistor: {
    physical: `
<line x1="8" y1="35" x2="22" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="98" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<rect x="20" y="22" width="80" height="26" rx="4" fill="url(#ceramic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<!-- 色环 -->
<rect x="28" y="22" width="6" height="26" fill="#dc2626"/>
<rect x="38" y="22" width="6" height="26" fill="#92400e"/>
<rect x="48" y="22" width="6" height="26" fill="#f59e0b"/>
<rect x="80" y="22" width="6" height="26" fill="#ca8a04"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="25" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="95" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<rect x="25" y="25" width="70" height="20" rx="2" fill="none" stroke="#334155" stroke-width="2.5"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 5. 滑动变阻器
  // ═════════════════════════════════════════════════════════════
  rheostat: {
    physical: `
<line x1="8" y1="35" x2="18" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="102" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 线圈 -->
<rect x="18" y="28" width="84" height="14" rx="3" fill="url(#ceramic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<path d="M22 28 L22 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M28 28 L28 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M34 28 L34 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M40 28 L40 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M46 28 L46 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M52 28 L52 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M58 28 L58 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M64 28 L64 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M70 28 L70 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M76 28 L76 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M82 28 L82 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M88 28 L88 42" stroke="#b45309" stroke-width="1.5"/>
<path d="M94 28 L94 42" stroke="#b45309" stroke-width="1.5"/>
<!-- 滑块 -->
<rect x="45" y="16" width="20" height="12" rx="2" fill="url(#metal)" stroke="#475569" stroke-width="0.8"/>
<line x1="55" y1="16" x2="55" y2="28" stroke="#475569" stroke-width="1.5"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="25" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="95" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<rect x="25" y="25" width="70" height="20" rx="2" fill="none" stroke="#334155" stroke-width="2.5"/>
<line x1="60" y1="25" x2="60" y2="15" stroke="#334155" stroke-width="2.5"/>
<line x1="50" y1="15" x2="70" y2="15" stroke="#334155" stroke-width="2.5"/>
<polygon points="60,12 55,18 65,18" fill="#334155"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 6. 电阻箱
  // ═════════════════════════════════════════════════════════════
  resistanceBox: {
    physical: `
<rect x="14" y="12" width="92" height="46" rx="4" fill="url(#plastic)" stroke="#64748b" stroke-width="1" filter="url(#shadow)"/>
<circle cx="27" cy="35" r="4" fill="url(#metal)" stroke="#64748b" stroke-width="0.8"/>
<circle cx="93" cy="35" r="4" fill="url(#metal)" stroke="#64748b" stroke-width="0.8"/>
<!-- 旋钮 -->
<circle cx="38" cy="35" r="8" fill="url(#metalH)" stroke="#64748b" stroke-width="0.8"/>
<text x="38" y="39" font-family="sans-serif" font-size="6" fill="#334155" text-anchor="middle" font-weight="bold">×1</text>
<circle cx="60" cy="35" r="8" fill="url(#metalH)" stroke="#64748b" stroke-width="0.8"/>
<text x="60" y="39" font-family="sans-serif" font-size="6" fill="#334155" text-anchor="middle" font-weight="bold">×10</text>
<circle cx="82" cy="35" r="8" fill="url(#metalH)" stroke="#64748b" stroke-width="0.8"/>
<text x="82" y="39" font-family="sans-serif" font-size="6" fill="#334155" text-anchor="middle" font-weight="bold">×100</text>
<circle cx="38" cy="55" r="8" fill="url(#metalH)" stroke="#64748b" stroke-width="0.8"/>
<text x="38" y="59" font-family="sans-serif" font-size="5" fill="#334155" text-anchor="middle" font-weight="bold">×1k</text>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="25" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="95" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<rect x="25" y="25" width="70" height="20" rx="2" fill="none" stroke="#334155" stroke-width="2.5"/>
<line x1="55" y1="25" x2="55" y2="45" stroke="#334155" stroke-width="1.5"/>
<line x1="70" y1="25" x2="70" y2="45" stroke="#334155" stroke-width="1.5"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 7. 电流表 — J0401 直流安培表
  // ═════════════════════════════════════════════════════════════
  ammeter: {
    physical: `
<rect x="14" y="4" width="92" height="132" rx="8" fill="url(#plastic)" stroke="#64748b" stroke-width="1.2" filter="url(#shadow)"/>
<rect x="15" y="5" width="90" height="130" rx="7" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
<rect x="14" y="4" width="92" height="13" rx="8" fill="#1e293b" opacity="0.12"/>
<rect x="14" y="13" width="92" height="4" fill="#1e293b" opacity="0.08"/>
<text x="60" y="12" font-family="sans-serif" font-size="5.5" fill="#334155" text-anchor="middle" font-weight="bold">J0401 直流安培表</text>
${meter270Dial(CX, CY, [0, 0.5, 1, 1.5, 2, 2.5, 3], 3, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], 0.6, 'A', '=  2.5级')}
<rect x="22" y="110" width="10" height="8" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="0.5"/>
<text x="27" y="115.5" font-family="sans-serif" font-size="5" fill="white" text-anchor="middle" font-weight="bold">−</text>
<rect x="50" y="110" width="10" height="8" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="0.5"/>
<text x="55" y="115.5" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">0.6</text>
<rect x="78" y="110" width="10" height="8" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="0.5"/>
<text x="83" y="115.5" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">3</text>
<text x="27" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">−</text>
<text x="55" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">0.6A</text>
<text x="83" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">3A</text>
<circle cx="60" cy="130" r="2.5" fill="url(#metal)" stroke="#64748b" stroke-width="0.4"/>
<line x1="57.5" y1="130" x2="62.5" y2="130" stroke="#475569" stroke-width="0.5"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="40" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="80" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="20" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="40" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">A</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 8. 电压表 — J0402 直流伏特表
  // ═════════════════════════════════════════════════════════════
  voltmeter: {
    physical: `
<rect x="14" y="4" width="92" height="132" rx="8" fill="url(#plastic)" stroke="#64748b" stroke-width="1.2" filter="url(#shadow)"/>
<rect x="15" y="5" width="90" height="130" rx="7" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
<rect x="14" y="4" width="92" height="13" rx="8" fill="#1e293b" opacity="0.12"/>
<rect x="14" y="13" width="92" height="4" fill="#1e293b" opacity="0.08"/>
<text x="60" y="12" font-family="sans-serif" font-size="5.5" fill="#334155" text-anchor="middle" font-weight="bold">J0402 直流伏特表</text>
${meter270Dial(CX, CY, [0, 2.5, 5, 7.5, 10, 12.5, 15], 15, [0, 0.5, 1, 1.5, 2, 2.5, 3], 3, 'V', '=  2.5级')}
<rect x="22" y="110" width="10" height="8" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="0.5"/>
<text x="27" y="115.5" font-family="sans-serif" font-size="5" fill="white" text-anchor="middle" font-weight="bold">−</text>
<rect x="50" y="110" width="10" height="8" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="0.5"/>
<text x="55" y="115.5" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">3</text>
<rect x="78" y="110" width="10" height="8" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="0.5"/>
<text x="83" y="115.5" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">15</text>
<text x="27" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">−</text>
<text x="55" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">3V</text>
<text x="83" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">15V</text>
<circle cx="60" cy="130" r="2.5" fill="url(#metal)" stroke="#64748b" stroke-width="0.4"/>
<line x1="57.5" y1="130" x2="62.5" y2="130" stroke="#475569" stroke-width="0.5"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="40" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="80" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="20" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="40" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">V</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 9. 电流计 — J0403 灵敏电流计
  // ═════════════════════════════════════════════════════════════
  galvanometer: {
    physical: `
<rect x="14" y="4" width="92" height="132" rx="8" fill="url(#plastic)" stroke="#64748b" stroke-width="1.2" filter="url(#shadow)"/>
<rect x="15" y="5" width="90" height="130" rx="7" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
<rect x="14" y="4" width="92" height="13" rx="8" fill="#1e293b" opacity="0.12"/>
<rect x="14" y="13" width="92" height="4" fill="#1e293b" opacity="0.08"/>
<text x="60" y="12" font-family="sans-serif" font-size="5.5" fill="#334155" text-anchor="middle" font-weight="bold">J0403 灵敏电流计</text>
<rect x="17" y="18" width="86" height="80" rx="4" fill="#fafafa" stroke="#94a3b8" stroke-width="0.8"/>
<rect x="18" y="19" width="84" height="78" rx="3" fill="none" stroke="#cbd5e1" stroke-width="0.4" opacity="0.5"/>
<!-- 180° arc (center-zero) -->
<path d="M ${CX - 33} ${CY} A 33 33 0 0 1 ${CX + 33} ${CY}" fill="none" stroke="#e2e8f0" stroke-width="7" stroke-linecap="round"/>
<path d="M ${CX - 33} ${CY} A 33 33 0 0 1 ${CX + 33} ${CY}" fill="none" stroke="#0f172a" stroke-width="1"/>
<path d="M ${CX - 30} ${CY} A 30 30 0 0 1 ${CX + 30} ${CY}" fill="none" stroke="#94a3b8" stroke-width="0.6" opacity="0.4"/>
<!-- Minor ticks -->
<g stroke="#64748b" stroke-width="0.6" stroke-linecap="round">
  <g transform="rotate(-75 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 30}"/></g>
  <g transform="rotate(-60 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 30}"/></g>
  <g transform="rotate(-45 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 30}"/></g>
  <g transform="rotate(-30 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 30}"/></g>
  <g transform="rotate(-15 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 30}"/></g>
  <g transform="rotate(15 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 30}"/></g>
  <g transform="rotate(30 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 30}"/></g>
  <g transform="rotate(45 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 30}"/></g>
  <g transform="rotate(60 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 30}"/></g>
  <g transform="rotate(75 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 30}"/></g>
</g>
<!-- Major ticks -->
<g stroke="#0f172a" stroke-width="1.5" stroke-linecap="round">
  <g transform="rotate(-90 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 25}"/></g>
  <g transform="rotate(-67.5 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 27}"/></g>
  <g transform="rotate(-45 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 25}"/></g>
  <g transform="rotate(-22.5 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 27}"/></g>
  <g transform="rotate(0 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 25}"/></g>
  <g transform="rotate(22.5 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 27}"/></g>
  <g transform="rotate(45 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 25}"/></g>
  <g transform="rotate(67.5 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 27}"/></g>
  <g transform="rotate(90 ${CX} ${CY})"><line x1="${CX}" y1="${CY - 33}" x2="${CX}" y2="${CY - 25}"/></g>
</g>
<!-- Outer scale numbers (high range ±1A) — OUTSIDE arc (radius=40) -->
<!-- Numbers at every 22.5°: -90°→-1, -67.5°→-0.75, -45°→-0.5, -22.5°→-0.25, 0°→0, 22.5°→0.25, 45°→0.5, 67.5°→0.75, 90°→1 -->
<g font-family="sans-serif" font-size="5" fill="#0f172a" text-anchor="middle" dominant-baseline="central" font-weight="bold">
  <text x="${CX - 40}" y="${CY}">−1</text>
  <text x="${(CX - 36.96).toFixed(2)}" y="${(CY - 15.31).toFixed(2)}" font-size="3.8" font-weight="normal">−0.75</text>
  <text x="${(CX - 28.28).toFixed(2)}" y="${(CY - 28.28).toFixed(2)}">−0.5</text>
  <text x="${(CX - 15.31).toFixed(2)}" y="${(CY - 36.96).toFixed(2)}" font-size="3.8" font-weight="normal">−0.25</text>
  <text x="${CX}" y="${CY - 40}" font-size="6.5" fill="#dc2626">0</text>
  <text x="${(CX + 15.31).toFixed(2)}" y="${(CY - 36.96).toFixed(2)}" font-size="3.8" font-weight="normal">0.25</text>
  <text x="${(CX + 28.28).toFixed(2)}" y="${(CY - 28.28).toFixed(2)}">0.5</text>
  <text x="${(CX + 36.96).toFixed(2)}" y="${(CY - 15.31).toFixed(2)}" font-size="3.8" font-weight="normal">0.75</text>
  <text x="${CX + 40}" y="${CY}">1</text>
</g>
<!-- Inner scale numbers (low range ±0.5A) — INSIDE arc (radius=25) -->
<g font-family="sans-serif" font-size="3.5" fill="#64748b" text-anchor="middle" dominant-baseline="central">
  <text x="${CX - 25}" y="${CY}">−0.5</text>
  <text x="${(CX - 21.65).toFixed(2)}" y="${(CY - 8.97).toFixed(2)}">−0.25</text>
  <text x="${CX}" y="${(CY - 25).toFixed(2)}" font-size="4" fill="#dc2626" font-weight="bold">0</text>
  <text x="${(CX + 21.65).toFixed(2)}" y="${(CY - 8.97).toFixed(2)}">0.25</text>
  <text x="${CX + 25}" y="${CY}">0.5</text>
</g>
<text x="${CX}" y="${CY + 15}" font-family="sans-serif" font-size="8" fill="#dc2626" text-anchor="middle" font-weight="bold">G</text>
  <text x="${CX}" y="${CY + 30}" font-family="sans-serif" font-size="3" fill="#64748b" text-anchor="middle">=  2.5级</text>
<path d="M17 18 Q60 15 103 18 L103 25 Q60 22 17 25Z" fill="white" opacity="0.12"/>
<rect x="22" y="110" width="10" height="8" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="0.5"/>
<text x="27" y="115.5" font-family="sans-serif" font-size="5" fill="white" text-anchor="middle" font-weight="bold">−</text>
<rect x="50" y="110" width="10" height="8" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="0.5"/>
<text x="55" y="115.5" font-family="sans-serif" font-size="3.5" fill="white" text-anchor="middle" font-weight="bold">G1</text>
<rect x="78" y="110" width="10" height="8" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="0.5"/>
<text x="83" y="115.5" font-family="sans-serif" font-size="3.5" fill="white" text-anchor="middle" font-weight="bold">G2</text>
<text x="27" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">−</text>
<text x="55" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">0.5A</text>
<text x="83" y="124" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">1A</text>
<circle cx="60" cy="130" r="2.5" fill="url(#metal)" stroke="#64748b" stroke-width="0.4"/>
<line x1="57.5" y1="130" x2="62.5" y2="130" stroke="#475569" stroke-width="0.5"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="40" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="80" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="20" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="40" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">G</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 10. 导线
  // ═════════════════════════════════════════════════════════════
  wire: {
    physical: `
<line x1="8" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 11. 接线柱
  // ═════════════════════════════════════════════════════════════
  terminal: {
    physical: `
<rect x="42" y="28" width="36" height="18" rx="3" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<rect x="48" y="16" width="24" height="12" rx="2" fill="url(#metal)" stroke="#64748b" stroke-width="0.8" filter="url(#shadowSm)"/>
<rect x="46" y="14" width="28" height="4" rx="1" fill="url(#metalH)" stroke="#475569" stroke-width="0.6"/>
<line x1="55" y1="22" x2="65" y2="22" stroke="#475569" stroke-width="0.8"/>
<line x1="60" y1="17" x2="60" y2="27" stroke="#475569" stroke-width="0.8"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="50" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="70" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="4" fill="none" stroke="#334155" stroke-width="2"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 12. 注释文字
  // ═════════════════════════════════════════════════════════════
  annotation: {
    physical: `<text x="60" y="35" font-family="sans-serif" font-size="10" fill="#334155" text-anchor="middle">注释</text>`.trim(),
    schematic: `<text x="60" y="35" font-family="sans-serif" font-size="10" fill="#334155" text-anchor="middle">注释</text>`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 13. 电动机
  // ═════════════════════════════════════════════════════════════
  motor: {
    physical: `
<line x1="8" y1="35" x2="22" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="98" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<rect x="20" y="18" width="80" height="34" rx="4" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<ellipse cx="60" cy="35" rx="18" ry="18" fill="url(#metal)" stroke="#64748b" stroke-width="0.8"/>
<text x="60" y="33" font-family="sans-serif" font-size="9" fill="#334155" text-anchor="middle" font-weight="bold">N</text>
<text x="60" y="42" font-family="sans-serif" font-size="7" fill="#94a3b8" text-anchor="middle">S</text>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="35" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="85" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="20" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="40" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">M</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 14. 发光二极管
  // ═════════════════════════════════════════════════════════════
  led: {
    physical: `
<line x1="8" y1="35" x2="25" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="95" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<rect x="22" y="22" width="76" height="26" rx="3" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<!-- LED chip -->
<circle cx="60" cy="35" r="8" fill="#ef4444" opacity="0.6"/>
<circle cx="60" cy="35" r="5" fill="#dc2626"/>
<!-- Arrow for light emission -->
<line x1="75" y1="25" x2="85" y2="20" stroke="#94a3b8" stroke-width="0.8"/>
<polygon points="85,20 80,22 83,25" fill="#94a3b8"/>
<line x1="80" y1="25" x2="90" y2="20" stroke="#94a3b8" stroke-width="0.8"/>
<polygon points="90,20 85,22 88,25" fill="#94a3b8"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="30" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="90" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<polygon points="30,22 30,48 60,35" fill="none" stroke="#334155" stroke-width="2.5"/>
<line x1="60" y1="22" x2="60" y2="48" stroke="#334155" stroke-width="2.5"/>
<line x1="70" y1="25" x2="80" y2="18" stroke="#334155" stroke-width="1.5"/>
<polygon points="80,18 74,22 78,24" fill="#334155"/>
<line x1="75" y1="28" x2="85" y2="21" stroke="#334155" stroke-width="1.5"/>
<polygon points="85,21 79,25 83,27" fill="#334155"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 15. 电铃
  // ═════════════════════════════════════════════════════════════
  buzzer: {
    physical: `
<line x1="8" y1="35" x2="22" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="98" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<rect x="20" y="20" width="80" height="30" rx="4" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<circle cx="60" cy="35" r="10" fill="url(#metal)" stroke="#64748b" stroke-width="0.8"/>
<text x="60" y="38" font-family="sans-serif" font-size="8" fill="#334155" text-anchor="middle" font-weight="bold">铃</text>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="30" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="90" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="20" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="40" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">铃</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 16. 保险丝
  // ═════════════════════════════════════════════════════════════
  fuse: {
    physical: `
<line x1="8" y1="35" x2="22" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="98" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<rect x="20" y="25" width="80" height="20" rx="3" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<rect x="35" y="28" width="50" height="14" rx="2" fill="url(#glass)" stroke="#64748b" stroke-width="0.8"/>
<line x1="40" y1="35" x2="80" y2="35" stroke="#b45309" stroke-width="1" stroke-linecap="round"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="30" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="90" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<rect x="30" y="25" width="60" height="20" rx="2" fill="none" stroke="#334155" stroke-width="2.5"/>
<line x1="40" y1="35" x2="80" y2="35" stroke="#334155" stroke-width="1"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 17. 读数标签
  // ═════════════════════════════════════════════════════════════
  readingLabel: {
    physical: `
<rect x="20" y="25" width="80" height="20" rx="3" fill="white" stroke="#94a3b8" stroke-width="0.8"/>
<text x="60" y="38" font-family="sans-serif" font-size="10" fill="#334155" text-anchor="middle">--</text>
`.trim(),
    schematic: `
<rect x="20" y="25" width="80" height="20" rx="3" fill="white" stroke="#94a3b8" stroke-width="0.8"/>
<text x="60" y="38" font-family="sans-serif" font-size="10" fill="#334155" text-anchor="middle">--</text>
`.trim(),
  },
};
