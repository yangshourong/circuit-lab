import { useEffect, useRef, useState, useMemo } from 'react';
import type React from 'react';
import { useStore, GRID } from '../store';
import type { PinRef } from '../types';
import { ComponentView } from './ComponentView';
import { CurrentFlow } from './CurrentFlow';
import {
  pinWorld,
  meterPhysicalEndpoint,
  physicalWirePath,
  physicalWireMidpoint,
  defaultWireControlPoints,
  buildWirePoints,
  schematicWirePath,
  simplifyTrail,
  smoothTrailPath,
  warpTrail,
  type Pt,
} from '../geometry';
import { getComponentDef } from '@circuit/core';
import { generateSchematicLayout, type SchematicLayout } from '../schematic-layout';

const NODE_RADIUS = 4; // 电路图节点圆点半径

type Gesture =
  | { type: 'none' }
  | { type: 'pan'; startX: number; startY: number; panX: number; panY: number }
  | { type: 'wire'; from: PinRef; fromWorld: { x: number; y: number } }
  | { type: 'move'; startWorld: { x: number; y: number }; base: Map<string, { x: number; y: number }>; moved: boolean }
  | { type: 'marquee'; startWorld: { x: number; y: number } }
  | { type: 'wireDrag'; wireId: string; cpIndex: number; startX: number; startY: number };

/** Pin snap radius (screen px) while the wire tool is active — generous magnet. */
const WIRE_SNAP_PX = 26;

export function Editor() {
  const graph = useStore((s) => s.graph);
  const view = useStore((s) => s.view);
  const selectedIds = useStore((s) => s.selectedIds);
  const largeScreen = useStore((s) => s.largeScreen);
  const solver = useStore((s) => s.solver);
  const tool = useStore((s) => s.tool);
  const wireStart = useStore((s) => s.wireStart);
  const breakpoint = useStore((s) => s.breakpoint);
  const placeType = useStore((s) => s.placeType);
  const setPlaceType = useStore((s) => s.setPlaceType);

  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture>({ type: 'none' });
  const spaceRef = useRef(false);
  const lastClickRef = useRef<{ compId: string; time: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [wirePreview, setWirePreview] = useState<{ d: string; snap: { x: number; y: number } | null } | null>(null);
  /** Raw pointer trail (world coords) accumulated while a wire is being routed. */
  const trailRef = useRef<Pt[]>([]);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  /** Touch pinch state for mobile zoom */
  const touchPinch = useRef<{
    id1: number; id2: number;
    startDist: number;
    center: { sx: number; sy: number; wx: number; wy: number };
    startZoom: number; startPanX: number; startPanY: number;
  } | null>(null);

  /** When true, a two-finger pinch is in progress; skip pointer gesture handling. */
  const pinchingRef = useRef(false);

  const isMobile = breakpoint === 'mobile' || breakpoint === 'tablet';

  // ── Auto-generated schematic layout (recomputed on graph change) ──
  const schemLayout: SchematicLayout | null = useMemo(() => {
    if (view.mode !== 'schematic') return null;
    return generateSchematicLayout(graph);
  }, [graph, view.mode]);

  // Quick lookup: compId -> schematic placement
  const schemPosMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number; rotation: number }>();
    if (!schemLayout) return m;
    for (const p of schemLayout.placements) m.set(p.compId, { x: p.x, y: p.y, rotation: p.rotation });
    return m;
  }, [schemLayout]);

  // --- screen <-> world conversion (reads live view from store) ---
  const toWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const v = useStore.getState().view;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return { x: (sx - v.panX) / v.zoom, y: (sy - v.panY) / v.zoom };
  };

  const findPinAt = (world: { x: number; y: number }, exclude?: PinRef, radiusPx = 14): PinRef | null => {
    const st = useStore.getState();
    const v = st.view;
    let best: PinRef | null = null;
    let bestD = radiusPx / v.zoom; // snap radius in world units
    for (const c of st.graph.components) {
      if (c.type === 'annotation') continue;
      for (const pinId of ['a', 'b'] as const) {
        if (exclude && exclude.componentId === c.id && exclude.pin === pinId) continue;
        const wp = pinWorld(c, pinId);
        const d = Math.hypot(wp.x - world.x, wp.y - world.y);
        if (d < bestD) {
          bestD = d;
          best = { componentId: c.id, pin: pinId };
        }
      }
    }
    return best;
  };

  /** World position of a PinRef, or null if the component vanished. */
  const pinRefWorld = (ref: PinRef): { x: number; y: number } | null => {
    const c = useStore.getState().graph.components.find((cc) => cc.id === ref.componentId);
    return c ? pinWorld(c, ref.pin) : null;
  };

  /**
   * Append the cursor to the routing trail (decimated) and refresh the
   * wire preview. The trail end magnetically snaps to a nearby pin.
   */
  const updateWirePreview = (start: PinRef, world: { x: number; y: number }) => {
    const st = useStore.getState();
    const startPos = pinRefWorld(start);
    if (!startPos) return;
    const zoom = st.view.zoom;
    const t = trailRef.current;
    const last: Pt = t.length ? t[t.length - 1] : [startPos.x, startPos.y];
    if (Math.hypot(world.x - last[0], world.y - last[1]) > 3 / zoom) {
      t.push([world.x, world.y]);
      if (t.length > 600) t.splice(0, t.length - 600); // hard cap
    }
    const snapRef = findPinAt(world, start, WIRE_SNAP_PX);
    const snapPos = snapRef ? pinRefWorld(snapRef) : null;
    const end = snapPos ?? world;
    const pts: Pt[] = [
      [startPos.x, startPos.y],
      ...simplifyTrail(t, 4 / zoom),
      [end.x, end.y],
    ];
    const d =
      st.view.mode === 'physical'
        ? smoothTrailPath(pts)
        : schematicWirePath(startPos, end);
    setWirePreview({ d, snap: snapPos });
  };

  /** Simplified, endpoint-anchored trail to persist onto a completed wire. */
  const finalizeTrail = (start: PinRef, end: PinRef): { trail?: Pt[]; controlPoints?: Pt[] } => {
    const a = pinRefWorld(start);
    const b = pinRefWorld(end);
    if (!a || !b) return {};
    const zoom = useStore.getState().view.zoom;
    const mid = simplifyTrail(trailRef.current, 5 / zoom);
    const pts: Pt[] = [[a.x, a.y], ...mid, [b.x, b.y]];
    // Drop interior points that hug the endpoints (kills the "hook" artifact)
    const cleaned = pts.filter((p, i) => {
      if (i === 0 || i === pts.length - 1) return true;
      return (
        Math.hypot(p[0] - a.x, p[1] - a.y) > 14 &&
        Math.hypot(p[0] - b.x, p[1] - b.y) > 14
      );
    });
    const trail = cleaned.length > 2 ? cleaned : undefined;
    // Always generate default control points for the new wire
    const controlPoints = defaultWireControlPoints(a, b) as Pt[];
    return { trail, controlPoints };
  };

  const resetWireRouting = () => {
    trailRef.current = [];
    setWirePreview(null);
  };

  // --- wheel zoom (native non-passive listener) ---
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useStore.getState();
      const v = st.view;
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldX = (sx - v.panX) / v.zoom;
      const worldY = (sy - v.panY) / v.zoom;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const zoom = Math.min(4, Math.max(0.2, v.zoom * factor));
      st.setView({ zoom, panX: sx - worldX * zoom, panY: sy - worldY * zoom });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // --- pinch-to-zoom (mobile touch) ---
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      e.preventDefault();
      // Mark pinch active so pointer handlers skip
      pinchingRef.current = true;
      gesture.current = { type: 'none' };
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const rect = el.getBoundingClientRect();
      const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
      const cy = (t1.clientY + t2.clientY) / 2 - rect.top;
      const st = useStore.getState();
      const v = st.view;
      touchPinch.current = {
        id1: t1.identifier, id2: t2.identifier,
        startDist: Math.hypot(dx, dy),
        center: { sx: cx, sy: cy, wx: (cx - v.panX) / v.zoom, wy: (cy - v.panY) / v.zoom },
        startZoom: v.zoom, startPanX: v.panX, startPanY: v.panY,
      };
    };
    const onTouchMove = (e: TouchEvent) => {
      const p = touchPinch.current;
      if (!p) return;
      e.preventDefault();
      if (e.touches.length < 2) return;
      // Find matching touches
      let t1: Touch | null = null, t2: Touch | null = null;
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.identifier === p.id1) t1 = t;
        if (t.identifier === p.id2) t2 = t;
      }
      if (!t1 || !t2) return;
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const factor = dist / p.startDist;
      const zoom = Math.min(4, Math.max(0.2, p.startZoom * factor));
      const { sx, sy, wx, wy } = p.center;
      const st = useStore.getState();
      st.setView({ zoom, panX: sx - wx * zoom, panY: sy - wy * zoom });
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchingRef.current = false;
        touchPinch.current = null;
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // --- space-to-pan tracking ---
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code === 'Space' && !t.closest('input,textarea,select')) {
        spaceRef.current = true;
        setSpaceDown(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false;
        setSpaceDown(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel a pending wire and drop back to the select tool.
        const st = useStore.getState();
        if (st.wireStart || st.tool === 'wire') {
          st.setWireStart(null);
          st.setTool('select');
          trailRef.current = [];
          setWirePreview(null);
        }
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('keydown', esc);
    };
  }, []);

  // --- track view size for zoom-around-centre ---
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      useStore.getState().setViewSize(r.width, r.height);
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    useStore.getState().setViewSize(r.width, r.height);
    return () => ro.disconnect();
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (pinchingRef.current) return;
    const st = useStore.getState();
    const target = e.target as Element;
    const world = toWorld(e.clientX, e.clientY);

    // ── 双击检测（不依赖 onDoubleClick，后者在 SVG dangerouslySetInnerHTML 下不可靠） ──
    if (e.button === 0 && st.tool !== 'wire') {
      const now = Date.now();
      const prev = lastClickRef.current;
      const compEl = target.closest('[data-comp]');
      if (compEl) {
        const compId = compEl.getAttribute('data-comp')!;
        if (prev && prev.compId === compId && now - prev.time < 350) {
          const comp = st.graph.components.find((c) => c.id === compId);
          if (comp?.type === 'switch') {
            st.setClosed(compId, comp.closed === false);
            lastClickRef.current = null;
            return;
          }
          if (comp?.type === 'multiSwitch') {
            const cur = Number(comp.params.position ?? 1);
            const next = cur >= 4 ? 0 : cur + 1; // 0→1→2→3→4→0
            st.updateParam(compId, 'position', String(next));
            lastClickRef.current = null;
            return;
          }
        }
        lastClickRef.current = { compId, time: now };
      } else {
        lastClickRef.current = null;
      }
    }

    // pan with middle mouse or space-held — available in every tool
    if (e.button === 1 || spaceRef.current) {
      gesture.current = { type: 'pan', startX: e.clientX, startY: e.clientY, panX: st.view.panX, panY: st.view.panY };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    // ================= PLACE TOOL (mobile click-to-place) =================
    if (st.tool === 'place') {
      const type = st.placeType;
      if (type) {
        st.addComponent(type, world.x, world.y);
        // Place once then return to select
        st.setTool('select');
        st.setPlaceType(null);
      } else {
        st.setTool('select');
      }
      return;
    }

    // ================= WIRE TOOL =================
    if (st.tool === 'wire') {
      // Magnetic pin pick-up: direct hit on the pin's hit-area OR any click
      // within the snap radius of a pin both count.
      const pinEl = target.closest('[data-pin]');
      let hitPin: PinRef | null = null;
      if (pinEl) {
        hitPin = { componentId: pinEl.getAttribute('data-comp')!, pin: pinEl.getAttribute('data-pin')! };
        // ── 仪表接线柱量程自动切换：点击低量程/高量程接线柱时，自动切换该仪表的量程参数 ──
        const rangeAttr = pinEl.getAttribute('data-range');
        if (rangeAttr) {
          const meterComp = st.graph.components.find((c) => c.id === hitPin!.componentId);
          if (meterComp) {
            const isMeter = meterComp.type === 'ammeter' || meterComp.type === 'voltmeter' || meterComp.type === 'galvanometer';
            if (isMeter) {
              // 根据仪表类型和点击的接线柱，确定对应的量程值
              const rangeMap: Record<string, { low: string; high: string }> = {
                ammeter:  { low: '0.6A', high: '3A' },
                voltmeter: { low: '3V', high: '15V' },
                galvanometer: { low: '0.5A', high: '1A' },
              };
              const ranges = rangeMap[meterComp.type];
              if (ranges) {
                const newRange = rangeAttr === 'low' ? ranges.low : ranges.high;
                if (meterComp.params?.range !== newRange) {
                  st.updateParam(meterComp.id, 'range', newRange);
                }
              }
            }
          }
        }
      } else {
        hitPin = findPinAt(world, st.wireStart ?? undefined, WIRE_SNAP_PX);
      }
      if (hitPin) {
        const comp = st.graph.components.find((c) => c.id === hitPin!.componentId);
        if (!comp) return;
        const start = st.wireStart;
        // Second click of a click-to-click connection
        if (start && !(start.componentId === hitPin.componentId && start.pin === hitPin.pin)) {
          const ft = finalizeTrail(start, hitPin);
          st.addWire(start, hitPin, ft.trail, ft.controlPoints); // clears wireStart
          resetWireRouting();
          return;
        }
        // First click: arm this pin, and also allow drag-to-connect
        const wp = pinWorld(comp, hitPin.pin);
        st.setWireStart(hitPin);
        trailRef.current = [];
        gesture.current = { type: 'wire', from: hitPin, fromWorld: wp };
        updateWirePreview(hitPin, world);
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return;
      }
      // Clicked empty space or a component body in wire mode -> cancel pending
      st.setWireStart(null);
      resetWireRouting();
      return;
    }

    // ================= SELECT TOOL =================
    // Control-point drag on a selected wire
    const cpEl = target.closest('[data-wire-cp]');
    if (cpEl && st.tool === 'select') {
      const wireId = cpEl.getAttribute('data-wire-cp')!.split(':')[0];
      const cpIndex = parseInt(cpEl.getAttribute('data-wire-cp')!.split(':')[1], 10);
      gesture.current = { type: 'wireDrag', wireId, cpIndex, startX: world.x, startY: world.y };
      st.beginGesture();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    // wire hit -> select the wire (delete via Del / delete button)
    const wireEl = target.closest('[data-wire]');
    if (wireEl) {
      const wid = wireEl.getAttribute('data-wire')!;
      if (e.shiftKey) st.toggleSelect(wid);
      else st.selectOnly(wid);
      // Ensure the wire has control points for drag handles
      st.ensureWireControlPoints(wid);
      return;
    }

    // select / move a component (pins fall through to component in select mode)
    const compEl = target.closest('[data-comp]');
    if (compEl) {
      const compId = compEl.getAttribute('data-comp')!;
      let sel = st.selectedIds;
      if (e.shiftKey) {
        st.toggleSelect(compId);
        sel = useStore.getState().selectedIds;
      } else if (!sel.includes(compId)) {
        st.selectOnly(compId);
        sel = [compId];
      }
      const base = new Map<string, { x: number; y: number }>();
      for (const c of st.graph.components) if (sel.includes(c.id)) base.set(c.id, { x: c.x, y: c.y });
      gesture.current = { type: 'move', startWorld: world, base, moved: false };
      st.beginGesture();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    // empty canvas -> marquee (or pan on mobile)
    if (!e.shiftKey) st.clearSelection();
    if (isMobile && st.tool === 'select') {
      // Single-finger pan on mobile (no space key needed)
      gesture.current = { type: 'pan', startX: e.clientX, startY: e.clientY, panX: st.view.panX, panY: st.view.panY };
    } else {
      gesture.current = { type: 'marquee', startWorld: world };
      setMarquee({ x1: world.x, y1: world.y, x2: world.x, y2: world.y });
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    const st = useStore.getState();
    const world = toWorld(e.clientX, e.clientY);
    // Wire tool armed (click-to-click) but no active drag: the routing trail
    // keeps following the cursor so the final cable mirrors the mouse path.
    if (g.type === 'none') {
      if (st.tool === 'wire' && st.wireStart) {
        updateWirePreview(st.wireStart, world);
      }
      return;
    }
    if (g.type === 'pan') {
      st.setView({ panX: g.panX + (e.clientX - g.startX), panY: g.panY + (e.clientY - g.startY) });
    } else if (g.type === 'wire') {
      updateWirePreview(g.from, world);
    } else if (g.type === 'move') {
      const dx = world.x - g.startWorld.x;
      const dy = world.y - g.startWorld.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) g.moved = true;
      const positions: Record<string, { x: number; y: number }> = {};
      g.base.forEach((v, id) => {
        positions[id] = { x: Math.round((v.x + dx) / GRID) * GRID, y: Math.round((v.y + dy) / GRID) * GRID };
      });
      st.setComponentPositionsLive(positions);
    } else if (g.type === 'wireDrag') {
      // Live-update the control point position
      st.updateWireControlPoint(g.wireId, g.cpIndex, world.x, world.y);
    } else if (g.type === 'marquee') {
      setMarquee({ x1: g.startWorld.x, y1: g.startWorld.y, x2: world.x, y2: world.y });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    const st = useStore.getState();
    if (g.type === 'wire') {
      const world = toWorld(e.clientX, e.clientY);
      const hit = findPinAt(world, g.from, WIRE_SNAP_PX);
      if (hit) {
        // Drag-to-connect completed on a different pin (snapped magnetically).
        const ft = finalizeTrail(g.from, hit);
        st.addWire(g.from, hit, ft.trail, ft.controlPoints); // clears wireStart
        resetWireRouting();
      }
      // Otherwise it was a click (no target pin): keep wireStart armed for a
      // second click; the trail keeps recording so the cable follows the mouse.
    } else if (g.type === 'move') {
      if (g.moved) {
        st.endGesture();
        if (isMobile) st.clearSelection();
      }
      else st.cancelGesture();
    } else if (g.type === 'wireDrag') {
      st.endGesture();
    } else if (g.type === 'marquee') {
      const m = marquee;
      if (m) {
        const xmin = Math.min(m.x1, m.x2);
        const xmax = Math.max(m.x1, m.x2);
        const ymin = Math.min(m.y1, m.y2);
        const ymax = Math.max(m.y1, m.y2);
        const ids = st.graph.components
          .filter((c) => c.x >= xmin && c.x <= xmax && c.y >= ymin && c.y <= ymax)
          .map((c) => c.id);
        const next = e.shiftKey ? Array.from(new Set([...st.selectedIds, ...ids])) : ids;
        st.selectMany(next);
      }
      setMarquee(null);
    }
    gesture.current = { type: 'none' };
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/x-circuit-component');
    if (!type) return;
    const world = toWorld(e.clientX, e.clientY);
    useStore.getState().addComponent(type, world.x, world.y);
  };

  const componentMap = new Map(graph.components.map((c) => [c.id, c]));

  return (
    <svg
      ref={svgRef}
      className="editor-svg"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}

      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ cursor: placeType ? 'copy' : spaceDown ? 'grab' : tool === 'wire' ? 'crosshair' : 'default' }}
    >
      <defs>
        <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e2e8f0" strokeWidth={1} />
        </pattern>
        <marker id="arrowRed" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#dc2626"/>
        </marker>
      </defs>
      <g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}>
        <rect x={-10000} y={-10000} width={20000} height={20000} fill="url(#grid)" />

        {/* ═══ SCHEMATIC WIRES (below components, textbook style) ═══ */}
        {view.mode === 'schematic' && schemLayout && (
          <>
            {schemLayout.wires.map((sw) => {
              const selected = selectedIds.includes(sw.id);
              return (
                <g key={sw.id}>
                  <path
                    d={sw.d}
                    fill="none"
                    stroke={selected ? '#2563eb' : '#1e293b'}
                    strokeWidth={selected ? 2.5 : 1.8}
                    strokeLinejoin="round"
                  />
                  <path d={sw.d} fill="none" stroke="transparent" strokeWidth={10}
                    data-wire={sw.id} style={{ cursor: 'pointer', pointerEvents: 'stroke' }} />
                </g>
              );
            })}
            {/* Junction dots: nodes where 3+ components meet */}
            {schemLayout.nodes.filter(n => n.degree >= 3).map(n => (
              <circle key={`jn-${n.id}`} cx={n.x} cy={n.y} r={NODE_RADIUS} fill="#1e293b" pointerEvents="none" />
            ))}
          </>
        )}

        {/* ═══ COMPONENTS ═══ */}
        {graph.components.filter(c => {
          // In schematic mode, hide wire/terminal/annotation — they are junction-only
          if (view.mode === 'schematic') return !['wire', 'terminal', 'annotation'].includes(c.type);
          return true;
        }).map((c) => {
          const def = getComponentDef(c.type);
          if (!def) return null;

          // In schematic mode, use auto-layout position; in physical mode, use placed coords
          const pos = view.mode === 'schematic' && schemLayout
            ? (schemPosMap.get(c.id) ?? { x: c.x, y: c.y, rotation: 0 })
            : { x: c.x, y: c.y, rotation: 0 };

          // Create a virtual PlacedComponent with layout position for rendering
          const displayComp = view.mode === 'schematic' && schemPosMap.has(c.id)
            ? { ...c, x: pos.x, y: pos.y, rotation: pos.rotation }
            : c;

          return (
            <g key={c.id}>
            <ComponentView
                comp={displayComp}
                def={def}
                selected={selectedIds.includes(c.id)}
                // 电路图模式不传读数：教材原理图只显示符号和名称，不显示数值
                reading={view.mode === 'schematic' ? undefined : solver?.readings[c.id]}
                mode={view.mode}
                largeScreen={largeScreen}
                wiring={tool === 'wire'}
                wireStart={wireStart}
              />
              {/* Schematic mode: show component label above symbol (textbook style) */}
              {view.mode === 'schematic' && (
                <text
                  x={pos.x}
                  y={pos.y - 38}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  fontSize={largeScreen ? 14 : 10}
                  fill="#64748b"
                  pointerEvents="none"
                >
                  {c.label || def.name}
                </text>
              )}
            </g>
          );
        })}

        {/* ═══ PHYSICAL WIRES (above components, like real hook-up leads) ═══ */}
        {view.mode === 'physical' && graph.wires.map((w) => {
          const fc = componentMap.get(w.from.componentId);
          const tc = componentMap.get(w.to.componentId);
          if (!fc || !tc) return null;
          // 仪表端点调整到底部接线柱位置
          const fromOverride = meterPhysicalEndpoint(fc, w.from.pin);
          const toOverride = meterPhysicalEndpoint(tc, w.to.pin);
          const a = fromOverride ?? pinWorld(fc, w.from.pin);
          const b = toOverride ?? pinWorld(tc, w.to.pin);
          const selected =
            selectedIds.includes(w.id) ||
            selectedIds.includes(w.from.componentId) ||
            selectedIds.includes(w.to.componentId);

          // controlPoints stores only interior mid-points; exit points are dynamic
          const hasCP = w.controlPoints && w.controlPoints.length > 0;
          let d: string;
          if (hasCP) {
            d = physicalWirePath(a, b, w.controlPoints as Pt[]);
          } else if (w.path && w.path.length >= 3) {
            d = smoothTrailPath(warpTrail(w.path as Pt[], a, b));
          } else {
            d = physicalWirePath(a, b);
          }

          // Compute display control points for handle rendering (interior only)
          const midPts = hasCP ? (w.controlPoints as Pt[]) : defaultWireControlPoints(a, b);

          return (
            <g key={w.id}>
              <>
                <path d={d} fill="none" stroke={selected ? '#2563eb' : '#0f172a'} strokeWidth={selected ? 7 : 6} strokeLinecap="round" />
                <path d={d} fill="none" stroke="#e2e8f0" strokeWidth={3.5} strokeLinecap="round" />
              </>
              <path d={d} fill="none" stroke="transparent" strokeWidth={12} data-wire={w.id} style={{ cursor: 'pointer', pointerEvents: 'stroke' }} />
              {/* Control-point handles for selected wire (draggable interior points) */}
              {selected && midPts.map((cp, i) => (
                <circle
                  key={`cp-${w.id}-${i}`}
                  cx={cp[0]}
                  cy={cp[1]}
                  r={6}
                  fill="white"
                  stroke="#2563eb"
                  strokeWidth={2}
                  style={{ cursor: 'grab', pointerEvents: 'all' }}
                  data-wire-cp={`${w.id}:${i}`}
                />
              ))}
              {/* wire label at midpoint of path */}
              {w.label && (() => {
                const mid = physicalWireMidpoint(a, b, hasCP ? (w.controlPoints as Pt[]) : undefined);
                return (
                  <text x={mid.x} y={mid.y - 2}
                    textAnchor="middle" fontFamily="sans-serif"
                    fontSize={10} fill="#475569" fontWeight="bold" pointerEvents="none">
                    {w.label}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* ═══ CURRENT FLOW ═══ */}
        {solver && solver.ok && view.mode === 'physical' && (
          <CurrentFlow
            graph={graph}
            solver={solver}
            mode={view.mode}
            componentMap={componentMap}
          />
        )}

        {/* live wire preview — follows the actual mouse trail */}
        {wirePreview && tool === 'wire' && (
          <g pointerEvents="none">
            <path
              d={wirePreview.d}
              stroke="#2563eb"
              strokeWidth={view.mode === 'physical' ? 4 : 2.5}
              strokeOpacity={0.85}
              strokeDasharray="7 5"
              strokeLinecap="round"
              fill="none"
            />
            {/* magnetic snap indicator: pulsing ring around the target post */}
            {wirePreview.snap && (
              <>
                <circle
                  cx={wirePreview.snap.x}
                  cy={wirePreview.snap.y}
                  r={13}
                  fill="rgba(22,163,74,0.15)"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                >
                  <animate attributeName="r" values="10;14;10" dur="0.9s" repeatCount="indefinite" />
                </circle>
                <circle cx={wirePreview.snap.x} cy={wirePreview.snap.y} r={4} fill="#16a34a" />
              </>
            )}
          </g>
        )}

        {/* marquee */}
        {marquee && (
          <rect
            x={Math.min(marquee.x1, marquee.x2)}
            y={Math.min(marquee.y1, marquee.y2)}
            width={Math.abs(marquee.x2 - marquee.x1)}
            height={Math.abs(marquee.y2 - marquee.y1)}
            fill="rgba(37,99,235,0.12)"
            stroke="#2563eb"
            strokeWidth={1}
            pointerEvents="none"
          />
        )}
      </g>
    </svg>
  );
}
