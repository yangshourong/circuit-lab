# Circuit Lab · 智能电路实验室

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> **面向中学物理实验教学的在线电路仿真平台。** 纯 TypeScript 电路仿真引擎 + Vite/React/SVG Web 编辑器，支持直流稳态分析（MNA 改进节点分析法），涵盖初中物理全部基本电路元件。
>
> **Live Demo:** _（待部署）_

---

## 📖 目录

- [项目简介](#-项目简介)
- [核心特性](#-核心特性)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [项目结构](#-项目结构)
- [架构概览](#-架构概览)
  - [仿真引擎 (core)](#-仿真引擎-core)
  - [Web 编辑器 (web)](#-web-编辑器-web)
- [支持的元件](#-支持的元件)
- [使用指南](#-使用指南)
- [实验任务](#-实验任务)
- [开发指南](#-开发指南)
- [许可证](#-许可证)

---

## 🎯 项目简介

**Circuit Lab** 是一个面向中学物理实验教学的开源电路仿真平台，目标是为教师和学生提供**零安装、即时可用**的电路实验环境。

### 为什么做这个项目？

- 🧪 **降低实验门槛** — 无需真实器材，即可搭建和测试各种电路
- 📐 **贴合教材** — 元件符号严格遵循中国中学物理教学标准
- ⚡ **即时反馈** — 修改电路参数后实时显示电流、电压等读数
- 📊 **数据分析** — 内置 U-I 图表、实验任务验证

### 两种视图模式

| 物理视图 | 电路图视图 |
|---------|------------|
| 展示元件物理外观，适合初学认知 | 使用标准电路图符号，适合电路分析 |
| 电池、灯泡等与实物一致 | 与国际/国内教材符号一致 |

---

## ✨ 核心特性

- **12 种电路元件** — 电池、开关、灯泡、定值电阻、滑动变阻器、电阻箱、电流表、电压表、灵敏电流计、导线、接线柱、标注
- **拖拽式编辑** — 从元件面板拖到画布，连接导线，所见即所得
- **实时仿真求解** — 基于 MNA（改进节点分析法）的直流稳态求解器，实时计算各支路电流和节点电压
- **参数调节** — 任意修改电阻值、电压值、内阻，滑块+数字输入双模式
- **表计读数** — 电流表 / 电压表 / 灵敏电流计带有表针 + 数字双显示
- **故障模拟** — 支持开路 / 短路故障设置，观察故障对电路的影响
- **实验任务系统** — 内置欧姆定律、电功率、串联分压等实验，自动评判实验数据正确性
- **U-I 图表** — 记录多组电压-电流数据，散点图展示，支持 CSV 导出
- **撤销/重做** — 完整的历史记录，操作可逆
- **导出功能** — 导出为 PNG 图片 / 实验文件 (.json) / CSV 数据
- **PWA 支持** — 可安装到桌面离线使用
- **SVG 矢量渲染** — 高清缩放不失真

---

## 🛠 技术栈

| 层次 | 技术 |
|------|------|
| **语言** | TypeScript 5 (全栈同构) |
| **仿真引擎** | 纯 TS，零 DOM 依赖 |
| **前端框架** | React 18 |
| **状态管理** | Zustand 4 (含 undo/redo) |
| **构建工具** | Vite 5 |
| **渲染** | SVG (内联矢量图) |
| **包管理** | npm workspaces (monorepo) |
| **PWA** | Service Worker + manifest |

---

## 🚀 快速开始

### 前置要求

- Node.js >= 20
- npm >= 9

### 安装

```bash
# 克隆仓库
git clone https://github.com/yangshourong/circuit-lab.git
cd circuit-lab

# 安装所有依赖（npm workspaces 自动处理 packages/core 和 packages/web）
npm install
```

### 启动开发服务器

```bash
# 启动 Web 编辑器（默认端口 5173）
npm run dev
```

打开浏览器访问 `http://localhost:5173`。

### 其他常用命令

```bash
# 构建生产版本
npm run build

# 运行仿真引擎测试（基准回归套件）
npm run test

# 仅对核心引擎做类型检查
npm run typecheck:core

# 仅对 Web 端做类型检查
npm run typecheck:web

# 仅构建核心引擎
npm run build:core

# 仅构建 Web 端
npm run build:web
```

---

## 📁 项目结构

```
circuit-lab/
├── package.json              # 根 monorepo 配置 (npm workspaces)
├── .gitignore
├── README.md
├── 中学电路图作图规范.md       # 元件符号设计规范
│
├── packages/
│   ├── core/                  # @circuit/core — 电路仿真引擎
│   │   ├── src/
│   │   │   ├── index.ts              # 公共 API
│   │   │   ├── types.ts              # 全部数据契约
│   │   │   ├── solver/
│   │   │   │   ├── mna.ts            # MNA 直流稳态求解器
│   │   │   │   └── matrix.ts         # Gauss-Jordan 消元（全主元）
│   │   │   ├── components/
│   │   │   │   └── registry.ts       # 12 种元件定义
│   │   │   └── file/
│   │   │       └── format.ts         # JSON 序列化/反序列化
│   │   ├── tests/
│   │   │   └── benchmarks.test.ts    # 基准回归测试
│   │   └── tsconfig.json
│   │
│   └── web/                   # @circuit/web — Web 编辑器
│       ├── index.html
│       ├── public/
│       │   ├── manifest.webmanifest # PWA 配置
│       │   └── sw.js                # Service Worker
│       └── src/
│           ├── main.tsx              # 入口
│           ├── App.tsx               # 顶层布局
│           ├── store.ts              # Zustand 全局状态
│           ├── types.ts              # Web 端类型
│           ├── geometry.ts           # 坐标/几何工具
│           ├── fileio.ts             # 文件导入导出
│           ├── schematic-layout.ts   # 自动布局引擎
│           ├── index.css             # 全局样式
│           ├── assets/
│           │   └── components/
│           │       ├── art.ts        # 双视图 SVG 元件图形
│           │       └── index.ts
│           ├── components/
│           │   ├── Editor.tsx        # SVG 画布
│           │   ├── ComponentView.tsx # 元件渲染
│           │   ├── CurrentFlow.tsx   # 电流动画
│           │   ├── Inspector.tsx     # 属性面板
│           │   ├── Meter.tsx         # 表计显示
│           │   ├── Palette.tsx       # 元件面板
│           │   ├── Toolbar.tsx       # 工具栏
│           │   └── Chart.tsx         # U-I 图表
│           └── tasks/
│               ├── Tasks.tsx         # 实验任务面板
│               └── definitions.ts    # 任务定义
│
└── .reasonix/                 # 开发工具配置（不纳入版本控制）
```

---

## 🏗 架构概览

### ⚙️ 仿真引擎 (core)

`packages/core` 是一个零 DOM 依赖的纯 TypeScript 电路仿真库，实现**改进节点分析法（Modified Nodal Analysis, MNA）** 直流稳态求解。

```
用户操作 → circuit graph → equipotential 合并 (union-find)
→ 节点编号 → 方程组构建 (stamping) → Gauss-Jordan 全主元消元
→ 求解结果 → 各支路电流、各节点电压 → 表计读数
```

| 模块 | 职责 |
|------|------|
| `types.ts` | `PlacedComponent`、`Wire`、`CircuitGraph`、`SolverResult`、`StampBuilder`、`ComponentDef` 等所有共享数据契约 |
| `solver/mna.ts` | MNA 直流稳态求解器 — 并查集合并等势点 → 节点索引 → 矩阵构建 → 求解 → 测量值提取 |
| `solver/matrix.ts` | Gauss-Jordan 消元法，采用**完全主元（行+列）选主**策略（MNA 在 KCL 行中放置支路电流未知数，对角线上可能出现零元素） |
| `components/registry.ts` | 12 种元件定义，每个元件声明引脚、参数、stamp 行为和故障支持 |
| `file/format.ts` | JSON 序列化/反序列化，支持版本验证（ExperimentFile v1） |

**关键设计原则：**

- 函数返回结构化结果 `{ ok, error?, ... }` 而非 throw
- 求解器永不 throw
- 元件行为通过 `StampBuilder`（电导、电压源、电流源）声明
- 等势点通过并查集自动合并
- 故障（正常/开路/短路）通过跳过 stamp 或短接主引脚处理

### 🌐 Web 编辑器 (web)

`packages/web` 是基于 Vite + React 18 + Zustand + SVG 的交互式电路编辑器。

```
用户操作 → Zustand Store (graph) → solveCircuit(graph)
→ SolverResult → 渲染表计读数 + 图表
```

| 组件 | 职责 |
|------|------|
| **Editor** | SVG 画布 — 拖放、引脚连线、框选、平移/缩放、滚轮缩放、网格 |
| **ComponentView** | 元件 SVG 渲染 — 高亮选中、故障标记、表计刻度 |
| **Inspector** | 属性面板 — 参数滑块/输入框、故障模式、旋转、实时读数 |
| **Palette** | 元件面板 — 拖拽添加、点击添加 |
| **Toolbar** | 顶部工具栏 — 撤销/重做、缩放、视图切换、导出 PNG/JSON |
| **Meter** | 表针 + 数字读数（电流表/电压表/灵敏电流计） |
| **Chart** | U-I 散点图 + CSV 导出 |
| **Tasks** | 实验任务面板 — 实时评判任务完成状态 |

---

## 🔌 支持的元件

| 元件 | 物理视图 | 电路图视图 | 可调参数 | 故障模拟 |
|------|---------|-----------|---------|---------|
| 🔋 电池 (Battery) | ✅ | ✅ | 电动势 E、内阻 r | 开路 |
| 🔘 开关 (Switch) | ✅ | ✅ | — | 开路 |
| 💡 灯泡 (Lamp) | ✅ | ✅ | 额定电压、额定功率 | 开路、短路 |
| 📏 定值电阻 (Resistor) | ✅ | ✅ | 阻值 R | 开路、短路 |
| 🎚 滑动变阻器 (Rheostat) | ✅ | ✅ | 最大阻值、滑片位置 | 开路 |
| 🔢 电阻箱 (Resistance Box) | ✅ | ✅ | 各档位阻值 | 开路 |
| 🔴 电流表 (Ammeter) | ✅ | ✅ | 量程 | — |
| 🔵 电压表 (Voltmeter) | ✅ | ✅ | 量程 | — |
| 📍 灵敏电流计 (Galvanometer) | ✅ | ✅ | 满偏电流 | — |
| ═ 导线 (Wire) | — | — | — | — |
| ⬤ 接线柱 (Terminal) | ✅ | ✅ | — | — |
| 📝 标注 (Annotation) | ✅ | ✅ | 文本内容 | — |

---

## 🎓 使用指南

### 基本操作

1. **添加元件** — 从左侧元件面板点击或拖拽到画布
2. **移动元件** — 在画布上拖拽元件
3. **旋转元件** — 选中后在属性面板点击旋转按钮（或快捷键）
4. **连接导线** — 从元件的引脚拖出到另一个引脚
5. **删除** — 选中后按 Delete 键
6. **撤销/重做** — 工具栏上的 ← → 按钮

### 编辑参数

- 选中元件，右侧属性面板显示可调参数
- 支持滑块拖拽和数字输入框
- 所有参数更改后**自动重新求解**电路

### 故障模拟

- 在属性面板中将元件模式设为「开路」或「短路」
- 故障状态在画布上以标记显示
- 可用于教学演示「如果这个元件坏了会怎样？」

### 导出与保存

- **导出图片** → 工具栏相机图标，导出 PNG
- **导出实验文件** → 工具栏保存图标，导出 .json
- **打开实验文件** → 工具栏打开图标，加载 .json
- **CSV 数据** → 在 U-I 图表面板点击导出

### 视图切换

- 工具栏切换「物理视图」和「电路图视图」
- 物理视图展示元件实物外观，适合初学认知
- 电路图视图使用标准符号，适合电路分析

---

## 📋 实验任务

系统内置了三个中学物理典型实验任务：

### 1️⃣ 欧姆定律实验
验证 I = U/R，通过改变电阻或电压，记录多组数据，验证电流与电压成正比、与电阻成反比。

### 2️⃣ 电功率实验
测量小灯泡在不同电压下的实际功率，理解额定功率与实际功率的关系。

### 3️⃣ 串联分压实验
探究串联电路中各电阻两端的电压分配规律，验证 U₁/U₂ = R₁/R₂。

每个任务会实时检查实验条件是否满足、数据是否正确，帮助学生自主完成实验探究。

---

## 🧑‍💻 开发指南

### 编码规范

- **语言**：UI 标签和用户可见字符串用**中文**；代码标识符、注释和技术文档用**英文**
- **命名**：camelCase 变量/函数、PascalCase 类型/接口、kebab-case 文件名
- **导入**：type-only 导入使用 `import type`；Vite 中 `@circuit/core` 路径别名直接指向 `../core/src/index.ts`
- **错误处理**：函数返回结构化结果 `{ ok, error?, ... }`，不使用 throw
- **状态管理**：所有可撤销的 mutation 调用 `pushHistory`；滑块编辑 700ms 合并窗口

### 添加新元件

1. 在 `packages/core/src/components/registry.ts` 中添加 `ComponentDef`
2. 定义引脚、参数、stamp 行为、故障支持
3. 在 `packages/web/src/assets/components/art.ts` 中添加 SVG 图形（物理视图和电路图视图）
4. 在 `packages/web/src/components/ComponentView.tsx` 中添加渲染逻辑（如需要）

### 运行测试

```bash
# 核心引擎基准回归测试（每个用例有已知解析解）
npm run test
```

---

## 📄 许可证

本项目采用 MIT 许可证 — 详情请查看 [LICENSE](LICENSE) 文件。

---

> **Circuit Lab · 智能电路实验室** — 让物理实验触手可及 ✨
