// 智能电路实验室 — v2 拟真元器件矢量素材
// 所有内容均为 120×70 视框内的「内部 SVG」(不含 <svg> 包裹)，
// 由 web 端在 <svg viewBox="0 0 120 70"> 中通过 dangerouslySetInnerHTML 注入。
// 左/右两个连接引脚固定在 (8,35) 与 (112,35)，须对齐 PIN_HALF = 52。
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
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="36" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="84" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="36" y1="35" x2="58" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="62" y1="28" x2="62" y2="42" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>
<line x1="62" y1="35" x2="84" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 2. 开关 — 木底座 + 黄铜刀闸
  // ═════════════════════════════════════════════════════════════
  switch: {
    physical: `
<line x1="8" y1="35" x2="28" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="92" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 木底座 -->
<rect x="28" y="36" width="64" height="14" rx="2" fill="#d97706" stroke="#92400e" stroke-width="1.2" filter="url(#shadowSm)"/>
<rect x="28" y="36" width="64" height="3" rx="1" fill="#f59e0b" opacity="0.5"/>
<!-- 左接线柱座（铰链端） -->
<rect x="30" y="24" width="10" height="12" rx="1.5" fill="url(#metal)" stroke="#475569" stroke-width="0.8" filter="url(#shadowSm)"/>
<circle cx="35" cy="30" r="3.5" fill="url(#metalH)" stroke="#64748b" stroke-width="0.8"/>
<!-- 右接线柱座（触点端） -->
<rect x="80" y="24" width="10" height="12" rx="1.5" fill="url(#metal)" stroke="#475569" stroke-width="0.8" filter="url(#shadowSm)"/>
<circle cx="85" cy="30" r="3.5" fill="url(#metalH)" stroke="#64748b" stroke-width="0.8"/>
<!-- 铰链轴 -->
<circle cx="35" cy="30" r="2.5" fill="url(#metal)" stroke="#475569" stroke-width="0.6"/>
<!-- 标签 -->
<text x="60" y="46" font-family="sans-serif" font-size="7" fill="#78716c" text-anchor="middle">开关</text>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="50" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="50" y1="35" x2="86" y2="19" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="50" cy="35" r="2.5" fill="#334155"/>
<circle cx="86" cy="19" r="3" fill="none" stroke="#334155" stroke-width="2"/>
<line x1="86" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 2b. 多向开关 — 旋转式选择开关
  // ═════════════════════════════════════════════════════════════
  multiSwitch: {
    physical: `
<line x1="8" y1="35" x2="14" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 加宽底座 -->
<rect x="14" y="10" width="82" height="48" rx="6" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadow)"/>
<rect x="14" y="10" width="82" height="4" rx="2" fill="white" opacity="0.08"/>
<!-- 4个触点（右侧，加大间距） -->
<g fill="url(#metal)" stroke="#64748b" stroke-width="0.7">
  <circle cx="90" cy="14" r="4"/>
  <circle cx="90" cy="28" r="4"/>
  <circle cx="90" cy="42" r="4"/>
  <circle cx="90" cy="56" r="4"/>
</g>
<!-- 触点引线至边缘 -->
<g stroke="#64748b" stroke-width="1.5" stroke-linecap="round">
  <line x1="90" y1="14" x2="108" y2="8"/>
  <line x1="90" y1="28" x2="108" y2="26"/>
  <line x1="90" y1="42" x2="108" y2="44"/>
  <line x1="90" y1="56" x2="108" y2="62"/>
</g>
<!-- 公共端（左侧） -->
<circle cx="22" cy="35" r="4" fill="url(#metalH)" stroke="#475569" stroke-width="0.8"/>
<!-- 旋转轴 -->
<circle cx="56" cy="35" r="10" fill="#475569" stroke="#1e293b" stroke-width="1.2" filter="url(#shadowSm)"/>
<circle cx="56" cy="35" r="5" fill="#64748b" stroke="#475569" stroke-width="0.8"/>
<!-- 档位数字标签 -->
<g font-family="sans-serif" font-size="6" fill="#64748b" text-anchor="middle">
  <text x="90" y="11">1</text>
  <text x="90" y="25">2</text>
  <text x="90" y="39">3</text>
  <text x="90" y="53">4</text>
</g>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="30" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<!-- 四个触点（纵向分布） -->
<g stroke="#334155" stroke-width="2.5">
  <circle cx="85" cy="14" r="2.5" fill="#334155"/>
  <circle cx="85" cy="28" r="2.5" fill="#334155"/>
  <circle cx="85" cy="42" r="2.5" fill="#334155"/>
  <circle cx="85" cy="56" r="2.5" fill="#334155"/>
</g>
<!-- 公共端 -->
<circle cx="30" cy="35" r="2.5" fill="#334155"/>
<!-- 选择臂（指向档位1） -->
<line x1="30" y1="35" x2="85" y2="14" stroke="#334155" stroke-width="2" stroke-linecap="round"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 3. 电灯 — 玻璃泡 + 螺口灯头 + 灯丝
  // ═════════════════════════════════════════════════════════════
  lamp: {
    physical: `
<line x1="8" y1="35" x2="34" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="86" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 灯座底板 -->
<rect x="38" y="42" width="44" height="8" rx="2" fill="#fcd34d" stroke="#b45309" stroke-width="1" filter="url(#shadowSm)"/>
<rect x="38" y="42" width="44" height="2" rx="1" fill="#fef3c7" opacity="0.6"/>
<!-- 螺口灯头 -->
<path d="M50 42 L50 34 L70 34 L70 42Z" fill="url(#metal)" stroke="#475569" stroke-width="0.8"/>
<line x1="52" y1="36" x2="68" y2="36" stroke="#64748b" stroke-width="0.6"/>
<line x1="52" y1="38" x2="68" y2="38" stroke="#64748b" stroke-width="0.6"/>
<line x1="52" y1="40" x2="68" y2="40" stroke="#64748b" stroke-width="0.6"/>
<!-- 玻璃泡体 -->
<circle cx="60" cy="21" r="15" fill="rgba(255,255,255,0.15)" stroke="#cbd5e1" stroke-width="1.5"/>
<!-- 玻璃高光 -->
<ellipse cx="54" cy="15" rx="6" ry="4" fill="white" opacity="0.3" transform="rotate(-20 54 15)"/>
<!-- 灯丝支架 -->
<line x1="56" y1="30" x2="57" y2="24" stroke="#78716c" stroke-width="0.8"/>
<line x1="64" y1="30" x2="63" y2="24" stroke="#78716c" stroke-width="0.8"/>
<!-- 灯丝（M 形） -->
<path d="M57 25 L59 21 L61 25 L63 21 L65 25" fill="none" stroke="#92400e" stroke-width="1.5" stroke-linejoin="round"/>
<!-- 底部触点 -->
<circle cx="60" cy="35" r="2.5" fill="url(#metalH)" stroke="#64748b" stroke-width="0.6"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="45" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="75" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="15" fill="none" stroke="#334155" stroke-width="2.5"/>
<line x1="50" y1="25" x2="70" y2="45" stroke="#334155" stroke-width="2"/>
<line x1="70" y1="25" x2="50" y2="45" stroke="#334155" stroke-width="2"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 4. 定值电阻 — 陶瓷电阻体 + 色环 + 绿色底座
  // ═════════════════════════════════════════════════════════════
  resistor: {
    physical: `
<line x1="8" y1="35" x2="32" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="88" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 绿色底座 -->
<rect x="32" y="40" width="56" height="10" rx="2" fill="#22c55e" stroke="#15803d" stroke-width="1" filter="url(#shadowSm)"/>
<rect x="32" y="40" width="56" height="3" rx="1" fill="#86efac" opacity="0.4"/>
<!-- 陶瓷电阻体 -->
<rect x="40" y="22" width="40" height="18" rx="3" fill="url(#ceramic)" stroke="#a8a29e" stroke-width="1" filter="url(#shadowSm)"/>
<!-- 端帽 -->
<rect x="40" y="22" width="5" height="18" rx="1" fill="url(#metal)" stroke="#64748b" stroke-width="0.5"/>
<rect x="75" y="22" width="5" height="18" rx="1" fill="url(#metal)" stroke="#64748b" stroke-width="0.5"/>
<!-- 引脚 -->
<line x1="36" y1="31" x2="40" y2="31" stroke="#94a3b8" stroke-width="2"/>
<line x1="80" y1="31" x2="88" y2="31" stroke="#94a3b8" stroke-width="2"/>
<!-- 色环 -->
<rect x="48" y="22" width="3.5" height="18" fill="#dc2626" rx="0.5"/>
<rect x="54" y="22" width="3.5" height="18" fill="#a855f7" rx="0.5"/>
<rect x="60" y="22" width="3.5" height="18" fill="#eab308" rx="0.5"/>
<rect x="72" y="22" width="3.5" height="18" fill="#f97316" rx="0.5"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="42" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="78" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<rect x="42" y="26" width="36" height="18" fill="none" stroke="#334155" stroke-width="2.5"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 5. 滑动变阻器 — 瓷管绕线 + 滑杆
  // ═════════════════════════════════════════════════════════════
  rheostat: {
    physical: `
<line x1="8" y1="35" x2="18" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="102" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 底座 -->
<rect x="18" y="44" width="84" height="14" rx="3" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<!-- 左侧接线柱 -->
<rect x="22" y="50" width="10" height="8" rx="2" fill="url(#metal)" stroke="#64748b" stroke-width="0.6"/>
<circle cx="27" cy="54" r="2" fill="#475569"/>
<line x1="27" y1="42" x2="27" y2="50" stroke="#64748b" stroke-width="2"/>
<!-- 右侧接线柱 -->
<rect x="88" y="50" width="10" height="8" rx="2" fill="url(#metal)" stroke="#64748b" stroke-width="0.6"/>
<circle cx="93" cy="54" r="2" fill="#475569"/>
<line x1="93" y1="42" x2="93" y2="50" stroke="#64748b" stroke-width="2"/>
<!-- 瓷管支架腿 -->
<rect x="28" y="46" width="4" height="6" fill="url(#metal)" stroke="#64748b" stroke-width="0.6"/>
<rect x="88" y="46" width="4" height="6" fill="url(#metal)" stroke="#64748b" stroke-width="0.6"/>
<!-- 瓷管 -->
<rect x="26" y="28" width="68" height="18" rx="4" fill="url(#ceramic)" stroke="#a8a29e" stroke-width="1" filter="url(#shadowSm)"/>
<!-- 绕线线圈 -->
<g stroke="#b45309" stroke-width="1.5" stroke-linejoin="round" fill="none" opacity="0.9">
  <path d="M30 42 L34 32 L38 42 L42 32 L46 42 L50 32 L54 42 L58 32 L62 42 L66 32 L70 42 L74 32 L78 42 L82 32 L86 42 L90 32"/>
</g>
<!-- 左端引线至接线柱 -->
<path d="M27 38 Q27 42 27 42" fill="none" stroke="#b45309" stroke-width="1.2"/>
<!-- 右端引线至接线柱 -->
<path d="M93 38 Q93 42 93 42" fill="none" stroke="#b45309" stroke-width="1.2"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="38" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="82" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<rect x="38" y="28" width="44" height="14" fill="none" stroke="#334155" stroke-width="2.5"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 6. 电阻箱 — 金属面板 + 旋钮
  // ═════════════════════════════════════════════════════════════
  resistanceBox: {
    physical: `
<line x1="8" y1="35" x2="24" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="96" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 箱体 -->
<rect x="24" y="14" width="72" height="40" rx="4" fill="url(#metal)" stroke="#64748b" stroke-width="1.5" filter="url(#shadow)"/>
<!-- 面板内凹 -->
<rect x="28" y="18" width="64" height="32" rx="2" fill="#1e293b" stroke="#0f172a" stroke-width="0.8"/>
<!-- 四个旋钮 -->
<g filter="url(#shadowSm)">
  <circle cx="40" cy="30" r="7" fill="url(#plastic)" stroke="#94a3b8" stroke-width="0.8"/>
  <circle cx="56" cy="30" r="7" fill="url(#plastic)" stroke="#94a3b8" stroke-width="0.8"/>
  <circle cx="72" cy="30" r="7" fill="url(#plastic)" stroke="#94a3b8" stroke-width="0.8"/>
  <circle cx="88" cy="30" r="7" fill="url(#plastic)" stroke="#94a3b8" stroke-width="0.8"/>
</g>
<!-- 旋钮指示线 -->
<g stroke="#dc2626" stroke-width="1.5" stroke-linecap="round">
  <line x1="40" y1="30" x2="40" y2="25"/>
  <line x1="56" y1="30" x2="56" y2="25"/>
  <line x1="72" y1="30" x2="72" y2="25"/>
  <line x1="88" y1="30" x2="88" y2="25"/>
</g>
<!-- 数字标签 -->
<text x="40" y="42" font-family="monospace" font-size="6" fill="#94a3b8" text-anchor="middle">×1</text>
<text x="56" y="42" font-family="monospace" font-size="6" fill="#94a3b8" text-anchor="middle">×10</text>
<text x="72" y="42" font-family="monospace" font-size="6" fill="#94a3b8" text-anchor="middle">×100</text>
<text x="88" y="42" font-family="monospace" font-size="6" fill="#94a3b8" text-anchor="middle">×1k</text>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="38" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="82" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<rect x="38" y="26" width="44" height="18" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="39" font-family="sans-serif" font-size="11" fill="#334155" text-anchor="middle">电阻箱</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 7-9. 电表 — 高拟真面板式仪表（3D 表壳 + 刻度盘 + 玻璃反光）
  // ═════════════════════════════════════════════════════════════
  ammeter: {
    physical: `
<line x1="8" y1="35" x2="14" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="106" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<rect x="14" y="4" width="92" height="60" rx="6" fill="url(#plastic)" stroke="#64748b" stroke-width="1.2" filter="url(#shadow)"/>
<rect x="15" y="5" width="90" height="58" rx="5" fill="none" stroke="white" stroke-width="0.5" opacity="0.15"/>
<!-- 表壳眉板（深色区域，印型号名称） -->
<rect x="14" y="4" width="92" height="9" rx="6" fill="#1e293b" opacity="0.15"/>
<rect x="14" y="9" width="92" height="4" fill="#1e293b" opacity="0.15"/>
<text x="60" y="10.5" font-family="sans-serif" font-size="5" fill="#334155" text-anchor="middle" font-weight="bold">J0401 直流安培表</text>
<!-- 刻度盘 -->
<rect x="20" y="13" width="80" height="44" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
<rect x="21" y="14" width="78" height="42" rx="3" fill="none" stroke="#94a3b8" stroke-width="0.5" opacity="0.3"/>
<!-- 反光镜 R=18 中心 60,35 -->
<path d="M47.3 47.7 A18 18 0 1 1 72.7 47.7" fill="none" stroke="#cbd5e1" stroke-width="4" opacity="0.5"/>
<path d="M47.3 45.7 A18 18 0 1 1 72.7 45.7" fill="none" stroke="#0f172a" stroke-width="1.2"/>
<g stroke="#0f172a" stroke-width="1" stroke-linecap="round">
  <line x1="47.3" y1="47.7" x2="51.5" y2="43.5"/>
  <line x1="42.0" y1="35.0" x2="48.0" y2="35.0"/>
  <line x1="47.3" y1="22.3" x2="51.5" y2="26.5"/>
  <line x1="60.0" y1="17.0" x2="60.0" y2="23.0"/>
  <line x1="72.7" y1="22.3" x2="68.5" y2="26.5"/>
  <line x1="78.0" y1="35.0" x2="72.0" y2="35.0"/>
  <line x1="72.7" y1="47.7" x2="68.5" y2="43.5"/>
</g>
<g stroke="#94a3b8" stroke-width="0.7" stroke-linecap="round">
  <line x1="44.6" y1="42.0" x2="46.8" y2="40.4"/>
  <line x1="44.6" y1="28.0" x2="46.8" y2="29.6"/>
  <line x1="54.1" y1="19.4" x2="55.6" y2="21.8"/>
  <line x1="65.9" y1="19.4" x2="64.4" y2="21.8"/>
  <line x1="75.4" y1="28.0" x2="73.2" y2="29.6"/>
  <line x1="75.4" y1="42.0" x2="73.2" y2="40.4"/>
</g>
<g font-family="sans-serif" font-size="5.5" fill="#0f172a" text-anchor="middle">
  <text x="53" y="43">0</text>
  <text x="53" y="28">1</text>
  <text x="67" y="28">2</text>
  <text x="67" y="43">3</text>
</g>
<text x="60" y="52" font-family="sans-serif" font-size="3.5" fill="#64748b" text-anchor="middle">A  0-0.6A  3A</text>
<path d="M20 13 Q60 10 100 13 L100 17 Q60 14 20 17Z" fill="white" opacity="0.12"/>
<rect x="30" y="57" width="8" height="5" rx="1" fill="#1e293b" stroke="#0f172a" stroke-width="0.4"/>
<text x="34" y="60" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">−</text>
<rect x="82" y="57" width="8" height="5" rx="1" fill="#dc2626" stroke="#991b1b" stroke-width="0.4"/>
<text x="86" y="60" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">+</text>
<text x="46" y="60" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">2.5级</text>
<circle cx="60" cy="58" r="2" fill="url(#metal)" stroke="#64748b" stroke-width="0.4"/>
<line x1="58.5" y1="58" x2="61.5" y2="58" stroke="#475569" stroke-width="0.4"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="40" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="80" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="20" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="40" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">A</text>
`.trim(),
  },

  voltmeter: {
    physical: `
<line x1="8" y1="35" x2="14" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="106" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<rect x="14" y="4" width="92" height="60" rx="6" fill="url(#plastic)" stroke="#64748b" stroke-width="1.2" filter="url(#shadow)"/>
<rect x="15" y="5" width="90" height="58" rx="5" fill="none" stroke="white" stroke-width="0.5" opacity="0.15"/>
<rect x="14" y="4" width="92" height="9" rx="6" fill="#1e293b" opacity="0.15"/>
<rect x="14" y="9" width="92" height="4" fill="#1e293b" opacity="0.15"/>
<text x="60" y="10.5" font-family="sans-serif" font-size="5" fill="#334155" text-anchor="middle" font-weight="bold">J0402 直流伏特表</text>
<rect x="20" y="13" width="80" height="44" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
<rect x="21" y="14" width="78" height="42" rx="3" fill="none" stroke="#94a3b8" stroke-width="0.5" opacity="0.3"/>
<path d="M47.3 47.7 A18 18 0 1 1 72.7 47.7" fill="none" stroke="#cbd5e1" stroke-width="4" opacity="0.5"/>
<path d="M47.3 45.7 A18 18 0 1 1 72.7 45.7" fill="none" stroke="#0f172a" stroke-width="1.2"/>
<g stroke="#0f172a" stroke-width="1" stroke-linecap="round">
  <line x1="47.3" y1="47.7" x2="51.5" y2="43.5"/>
  <line x1="42.0" y1="35.0" x2="48.0" y2="35.0"/>
  <line x1="47.3" y1="22.3" x2="51.5" y2="26.5"/>
  <line x1="60.0" y1="17.0" x2="60.0" y2="23.0"/>
  <line x1="72.7" y1="22.3" x2="68.5" y2="26.5"/>
  <line x1="78.0" y1="35.0" x2="72.0" y2="35.0"/>
  <line x1="72.7" y1="47.7" x2="68.5" y2="43.5"/>
</g>
<g stroke="#94a3b8" stroke-width="0.7" stroke-linecap="round">
  <line x1="44.6" y1="42.0" x2="46.8" y2="40.4"/>
  <line x1="44.6" y1="28.0" x2="46.8" y2="29.6"/>
  <line x1="54.1" y1="19.4" x2="55.6" y2="21.8"/>
  <line x1="65.9" y1="19.4" x2="64.4" y2="21.8"/>
  <line x1="75.4" y1="28.0" x2="73.2" y2="29.6"/>
  <line x1="75.4" y1="42.0" x2="73.2" y2="40.4"/>
</g>
<g font-family="sans-serif" font-size="5.5" fill="#0f172a" text-anchor="middle">
  <text x="53" y="43">0</text>
  <text x="53" y="28">5</text>
  <text x="67" y="28">10</text>
  <text x="67" y="43">15</text>
</g>
<text x="60" y="52" font-family="sans-serif" font-size="3.5" fill="#64748b" text-anchor="middle">V  0-3V  15V</text>
<path d="M20 13 Q60 10 100 13 L100 17 Q60 14 20 17Z" fill="white" opacity="0.12"/>
<rect x="30" y="57" width="8" height="5" rx="1" fill="#1e293b" stroke="#0f172a" stroke-width="0.4"/>
<text x="34" y="60" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">−</text>
<rect x="82" y="57" width="8" height="5" rx="1" fill="#dc2626" stroke="#991b1b" stroke-width="0.4"/>
<text x="86" y="60" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">+</text>
<text x="46" y="60" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">2.5级</text>
<circle cx="60" cy="58" r="2" fill="url(#metal)" stroke="#64748b" stroke-width="0.4"/>
<line x1="58.5" y1="58" x2="61.5" y2="58" stroke="#475569" stroke-width="0.4"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="40" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="80" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="20" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="40" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">V</text>
`.trim(),
  },

  galvanometer: {
    physical: `
<line x1="8" y1="35" x2="14" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="106" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<rect x="14" y="4" width="92" height="60" rx="6" fill="url(#plastic)" stroke="#64748b" stroke-width="1.2" filter="url(#shadow)"/>
<rect x="15" y="5" width="90" height="58" rx="5" fill="none" stroke="white" stroke-width="0.5" opacity="0.15"/>
<rect x="14" y="4" width="92" height="9" rx="6" fill="#1e293b" opacity="0.15"/>
<rect x="14" y="9" width="92" height="4" fill="#1e293b" opacity="0.15"/>
<text x="60" y="10.5" font-family="sans-serif" font-size="5" fill="#334155" text-anchor="middle" font-weight="bold">J0403 灵敏电流计</text>
<rect x="20" y="13" width="80" height="44" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
<rect x="21" y="14" width="78" height="42" rx="3" fill="none" stroke="#94a3b8" stroke-width="0.5" opacity="0.3"/>
<!-- G 表零位居中弧 R=18 中心 60,33 -->
<path d="M42 33 A18 18 0 0 1 78 33" fill="none" stroke="#cbd5e1" stroke-width="4" opacity="0.5"/>
<path d="M43 33 A17 17 0 0 1 77 33" fill="none" stroke="#0f172a" stroke-width="1.2"/>
<g stroke="#0f172a" stroke-width="1" stroke-linecap="round">
  <line x1="43.0" y1="33.0" x2="47.0" y2="33.0"/>
  <line x1="45.3" y1="24.5" x2="48.7" y2="26.5"/>
  <line x1="51.5" y1="18.3" x2="53.5" y2="21.7"/>
  <line x1="60.0" y1="16.0" x2="60.0" y2="20.0"/>
  <line x1="68.5" y1="18.3" x2="66.5" y2="21.7"/>
  <line x1="74.7" y1="24.5" x2="71.3" y2="26.5"/>
  <line x1="77.0" y1="33.0" x2="73.0" y2="33.0"/>
</g>
<g stroke="#94a3b8" stroke-width="0.7" stroke-linecap="round">
  <line x1="44.2" y1="28.8" x2="46.5" y2="30.2"/>
  <line x1="48.4" y1="21.4" x2="50.5" y2="23.2"/>
  <line x1="55.6" y1="17.2" x2="56.8" y2="19.8"/>
  <line x1="64.4" y1="17.2" x2="63.2" y2="19.8"/>
  <line x1="71.6" y1="21.4" x2="69.5" y2="23.2"/>
  <line x1="75.8" y1="28.8" x2="73.5" y2="30.2"/>
</g>
<g font-family="sans-serif" font-size="5.5" fill="#0f172a" text-anchor="middle">
  <text x="47" y="37">−1</text>
  <text x="52" y="24">−0.5</text>
  <text x="60" y="21" font-size="6" fill="#dc2626" font-weight="bold">0</text>
  <text x="68" y="24">0.5</text>
</g>
<text x="60" y="52" font-family="sans-serif" font-size="3.5" fill="#64748b" text-anchor="middle">G  ±0.5A  ±1A</text>
<path d="M20 13 Q60 10 100 13 L100 17 Q60 14 20 17Z" fill="white" opacity="0.12"/>
<rect x="30" y="57" width="8" height="5" rx="1" fill="#1e293b" stroke="#0f172a" stroke-width="0.4"/>
<text x="34" y="60" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">−</text>
<rect x="82" y="57" width="8" height="5" rx="1" fill="#dc2626" stroke="#991b1b" stroke-width="0.4"/>
<text x="86" y="60" font-family="sans-serif" font-size="4.5" fill="white" text-anchor="middle" font-weight="bold">+</text>
<text x="46" y="60" font-family="sans-serif" font-size="3" fill="#94a3b8" text-anchor="middle">2.5级</text>
<circle cx="60" cy="58" r="2" fill="url(#metal)" stroke="#64748b" stroke-width="0.4"/>
<line x1="58.5" y1="58" x2="61.5" y2="58" stroke="#475569" stroke-width="0.4"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="40" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="80" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="20" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="40" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">G</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 10. 导线 — 简单直线
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
  // 11. 接线柱 — 金属圆柱
  // ═════════════════════════════════════════════════════════════
  terminal: {
    physical: `
<!-- 绝缘底座 -->
<rect x="42" y="28" width="36" height="18" rx="3" fill="url(#plastic)" stroke="#94a3b8" stroke-width="1" filter="url(#shadowSm)"/>
<!-- 金属接线柱 -->
<rect x="48" y="16" width="24" height="12" rx="2" fill="url(#metal)" stroke="#64748b" stroke-width="0.8" filter="url(#shadowSm)"/>
<!-- 顶部螺帽 -->
<rect x="46" y="14" width="28" height="4" rx="1" fill="url(#metalH)" stroke="#475569" stroke-width="0.6"/>
<!-- 十字槽 -->
<line x1="55" y1="22" x2="65" y2="22" stroke="#475569" stroke-width="0.8"/>
<line x1="60" y1="17" x2="60" y2="27" stroke="#475569" stroke-width="0.8"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="50" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="70" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="4" fill="#334155"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 12. 注释 — 黄色便签
  // ═════════════════════════════════════════════════════════════
  annotation: {
    physical: `
<rect x="28" y="24" width="64" height="22" rx="3" fill="#fef9c3" stroke="#ca8a04" stroke-width="1" stroke-dasharray="4 3" filter="url(#shadowSm)"/>
<!-- 折角 -->
<path d="M92 24 L92 30 L86 24Z" fill="#fef9c3" stroke="#ca8a04" stroke-width="0.5"/>
<text x="60" y="39" font-family="sans-serif" font-size="11" fill="#854d0e" text-anchor="middle">注释</text>
`.trim(),
    schematic: `
<text x="60" y="40" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">注释</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 13. 电动机 — 金属外壳 + 磁铁 + 换向器
  // ═════════════════════════════════════════════════════════════
  motor: {
    physical: `
<line x1="8" y1="35" x2="22" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="98" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 电机外壳 -->
<circle cx="60" cy="33" r="26" fill="url(#metal)" stroke="#64748b" stroke-width="2" filter="url(#shadow)"/>
<!-- 磁铁 N -->
<rect x="40" y="13" width="10" height="16" rx="2" fill="#ef4444" stroke="#b91c1c" stroke-width="0.8"/>
<text x="45" y="25" font-family="sans-serif" font-size="8" fill="white" text-anchor="middle" font-weight="bold">N</text>
<!-- 磁铁 S -->
<rect x="70" y="13" width="10" height="16" rx="2" fill="#3b82f6" stroke="#1d4ed8" stroke-width="0.8"/>
<text x="75" y="25" font-family="sans-serif" font-size="8" fill="white" text-anchor="middle" font-weight="bold">S</text>
<!-- 电枢 -->
<circle cx="60" cy="33" r="12" fill="#fef9c3" stroke="#b45309" stroke-width="1.5"/>
<!-- 换向器 -->
<rect x="57" y="44" width="6" height="5" rx="0.5" fill="#94a3b8" stroke="#475569" stroke-width="0.6"/>
<!-- 转轴 -->
<line x1="60" y1="7" x2="60" y2="59" stroke="#78716c" stroke-width="2.5" stroke-linecap="round"/>
<!-- 电刷 -->
<rect x="26" y="50" width="7" height="5" rx="1.5" fill="url(#metal)" stroke="#64748b" stroke-width="0.6"/>
<rect x="87" y="50" width="7" height="5" rx="1.5" fill="url(#metal)" stroke="#64748b" stroke-width="0.6"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="40" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="80" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="35" r="20" fill="none" stroke="#334155" stroke-width="2.5"/>
<text x="60" y="40" font-family="sans-serif" font-size="16" fill="#334155" text-anchor="middle" font-weight="bold">M</text>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 14. 发光二极管 — 子弹头透镜
  // ═════════════════════════════════════════════════════════════
  led: {
    physical: `
<line x1="8" y1="35" x2="42" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="78" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 透镜（子弹头） -->
<path d="M42 24 Q44 14 60 6 Q76 14 78 24Z" fill="#dc2626" stroke="#991b1b" stroke-width="1.5" opacity="0.85" filter="url(#shadowSm)"/>
<!-- 透镜高光 -->
<ellipse cx="52" cy="12" rx="7" ry="3.5" fill="white" opacity="0.25" transform="rotate(-15 52 12)"/>
<!-- 阴极短脚 -->
<line x1="60" y1="24" x2="60" y2="46" stroke="url(#metal)" stroke-width="2"/>
<rect x="55" y="44" width="10" height="8" rx="1.5" fill="url(#metal)" stroke="#64748b" stroke-width="0.6"/>
<!-- 阴极平边标记 -->
<rect x="54" y="40" width="12" height="2.5" rx="0.5" fill="#64748b"/>
<!-- 阳极长脚 -->
<line x1="60" y1="24" x2="60" y2="35" stroke="#1e293b" stroke-width="2.5"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="40" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="80" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<!-- 二极管三角 -->
<polygon points="40,35 68,22 68,48" fill="none" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
<line x1="68" y1="20" x2="68" y2="50" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<!-- 发光箭头 -->
<line x1="54" y1="16" x2="54" y2="8" stroke="#dc2626" stroke-width="2" stroke-linecap="round" marker-end="url(#arrowRed)"/>
<line x1="60" y1="14" x2="60" y2="6" stroke="#dc2626" stroke-width="2" stroke-linecap="round" marker-end="url(#arrowRed)"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 15. 电铃 — 铃罩 + 电磁铁 + 衔铁
  // ═════════════════════════════════════════════════════════════
  bell: {
    physical: `
<line x1="8" y1="35" x2="22" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="98" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 底座 -->
<rect x="28" y="48" width="64" height="10" rx="2" fill="url(#metal)" stroke="#64748b" stroke-width="1" filter="url(#shadowSm)"/>
<!-- 电磁铁铁芯 -->
<rect x="42" y="32" width="16" height="16" rx="2" fill="url(#metal)" stroke="#64748b" stroke-width="0.8" filter="url(#shadowSm)"/>
<!-- 线圈 -->
<g fill="none" stroke="#f59e0b" stroke-width="1.2">
  <line x1="44" y1="34" x2="56" y2="34"/>
  <line x1="44" y1="37" x2="56" y2="37"/>
  <line x1="44" y1="40" x2="56" y2="40"/>
  <line x1="44" y1="43" x2="56" y2="43"/>
</g>
<!-- 铁芯顶部 -->
<rect x="48" y="28" width="4" height="4" fill="#64748b"/>
<!-- 铃罩 -->
<path d="M36 28 Q60 6 84 28" fill="none" stroke="#b45309" stroke-width="3" stroke-linecap="round"/>
<!-- 衔铁 -->
<line x1="62" y1="38" x2="80" y2="38" stroke="url(#metal)" stroke-width="2.5" stroke-linecap="round"/>
<!-- 锤子 -->
<circle cx="80" cy="33" r="4" fill="#78716c" stroke="#475569" stroke-width="0.8"/>
<!-- 触点螺丝 -->
<rect x="60" y="46" width="8" height="4" rx="1" fill="#fcd34d" stroke="#b45309" stroke-width="0.6"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="40" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="80" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<path d="M40 28 Q60 10 80 28" fill="none" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="60" y1="28" x2="60" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="60" cy="22" r="3" fill="#334155"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 16. 保险丝 — 玻璃管 + 金属帽 + 熔丝
  // ═════════════════════════════════════════════════════════════
  fuse: {
    physical: `
<line x1="8" y1="35" x2="30" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<line x1="90" y1="35" x2="112" y2="35" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
<!-- 玻璃管 -->
<rect x="30" y="24" width="60" height="22" rx="4" fill="rgba(255,255,255,0.08)" stroke="#94a3b8" stroke-width="1.5" filter="url(#shadowSm)"/>
<!-- 玻璃光泽 -->
<rect x="32" y="26" width="56" height="5" rx="2" fill="white" opacity="0.2"/>
<!-- 金属帽 -->
<rect x="30" y="30" width="6" height="10" rx="1" fill="url(#metal)" stroke="#64748b" stroke-width="0.6"/>
<rect x="84" y="30" width="6" height="10" rx="1" fill="url(#metal)" stroke="#64748b" stroke-width="0.6"/>
<!-- 熔丝 -->
<path d="M36 35 L48 35 Q52 35 54 32 Q56 29 58 35 Q60 41 62 38 Q64 35 68 35 L84 35" fill="none" stroke="#78716c" stroke-width="1.8" stroke-linejoin="round"/>
`.trim(),
    schematic: `
<line x1="8" y1="35" x2="40" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<line x1="80" y1="35" x2="112" y2="35" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
<rect x="40" y="24" width="40" height="22" fill="none" stroke="#334155" stroke-width="2.5"/>
<line x1="40" y1="35" x2="80" y2="35" stroke="#334155" stroke-width="2" stroke-linecap="round"/>
`.trim(),
  },

  // ═════════════════════════════════════════════════════════════
  // 17. 读数标签 — 深色读数框
  // ═════════════════════════════════════════════════════════════
  readingLabel: {
    physical: `
<rect x="30" y="24" width="60" height="22" rx="4" fill="#1e293b" stroke="#0f172a" stroke-width="1" filter="url(#shadowSm)"/>
<!-- 内发光边框 -->
<rect x="31.5" y="25.5" width="57" height="19" rx="3" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.4"/>
<text x="60" y="39" font-family="monospace" font-size="10" fill="#22d3ee" text-anchor="middle" font-weight="bold">--</text>
`.trim(),
    schematic: `
<rect x="30" y="24" width="60" height="22" rx="4" fill="#1e293b" stroke="#0f172a" stroke-width="1"/>
<rect x="31.5" y="25.5" width="57" height="19" rx="3" fill="none" stroke="#22d3ee" stroke-width="0.5" opacity="0.4"/>
<text x="60" y="39" font-family="monospace" font-size="10" fill="#22d3ee" text-anchor="middle" font-weight="bold">--</text>
`.trim(),
  },
};
