import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const seedText = `Chapter 1 — Down the Rabbit-Hole

Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice "without pictures or conversations?"

So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.

There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, "Oh dear! Oh dear! I shall be late!" (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.

In another moment down went Alice after it, never once considering how in the world she was to get out again.

The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well. `;

const initialBeats = [
  {
    id: "b1",
    title: "Opening",
    text: "Alice is bored by the riverbank and notices a curious White Rabbit.",
    parentId: null,
    kind: "main",
    options: [
      { id: "b1a", title: "Stay Still", text: "Alice watches quietly, letting the moment unfold around her." },
      { id: "b1b", title: "Ask a Question", text: "Alice calls out to the rabbit, hoping for an explanation." },
    ],
  },
  {
    id: "b2",
    title: "Descent",
    text: "She tumbles through the rabbit-hole into a strange new world.",
    parentId: "b1",
    kind: "main",
    options: [
      { id: "b2a", title: "Drink the Potion", text: "A mysterious bottle changes Alice in an unexpected way." },
      { id: "b2b", title: "Speak to the Creatures", text: "Alice tries to make sense of the voices all around her." },
    ],
  },
  {
    id: "b3",
    title: "Wonderland",
    text: "The world below follows its own rules, and Alice must adapt quickly.",
    parentId: "b2",
    kind: "main",
    options: [
      { id: "b3a", title: "Join the Tea Party", text: "Alice accepts the invitation to an absurd and lively table." },
      { id: "b3b", title: "Challenge the Queen", text: "Alice decides to stand up to a powerful and temperamental ruler." },
      { id: "b3c", title: "Find a Way Home", text: "Alice begins searching for a path back to the world above." },
    ],
  },
];

function buildNodeMap(nodes) {
  const map = new Map();
  nodes.forEach((n) => map.set(n.id, n));
  return map;
}

// selected=blue, isSuggestion=purple, otherwise=green
function NodePill({ node, selected, onClick, x, y, width = 210, isSuggestion = false }) {
  const left = x - width / 2;
  const styles = selected
    ? "border-sky-400/80 bg-sky-500/20 shadow-[0_0_0_1px_rgba(56,189,248,0.25)]"
    : isSuggestion
      ? "border-violet-400/50 bg-violet-500/10 hover:bg-violet-500/20"
      : "border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/15";

  const label = selected ? "Selected" : isSuggestion ? "Suggestion" : node.kind === "branch" ? "Branch" : "Beat";

  return (
    <button
      onClick={onClick}
      className={`absolute rounded-2xl border px-4 py-3 text-left transition ${styles}`}
      style={{ left, top: y, width }}
    >
      <div className="text-xs uppercase tracking-[0.22em] text-white/50">{label}</div>
      <div className="mt-1 text-base font-semibold text-white">{node.title}</div>
      <div className="mt-1 text-sm leading-5 text-white/65">{node.text}</div>
    </button>
  );
}

export default function CreativeWritingTool() {
  const [text, setText] = useState(seedText);
  const [selectedId, setSelectedId] = useState(null);
  const [nodes, setNodes] = useState(initialBeats);
  // Unexplored suggestion nodes: id → node. Separate from committed `nodes`.
  const [suggestions, setSuggestions] = useState(new Map());
  const [leftWidth, setLeftWidth] = useState(420);
  const [isDragging, setIsDragging] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const graphContainerRef = useRef(null);
  const dragRef = useRef(false);
  const panRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const canvasSizeRef = useRef({ w: 600, h: 500 });

  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    dragRef.current = true;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (dragRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setLeftWidth(Math.max(280, Math.min(e.clientX - rect.left, rect.width - 480)));
      }
      if (panRef.current.tracking) {
        const dx = e.clientX - panRef.current.startX;
        const dy = e.clientY - panRef.current.startY;
        if (!panRef.current.active && Math.hypot(dx, dy) > 4) {
          panRef.current.active = true;
        }
        if (panRef.current.active) {
          setPan({ x: panRef.current.originX + dx, y: panRef.current.originY + dy });
        }
      }
    };
    const onMouseUp = () => {
      dragRef.current = false;
      setIsDragging(false);
      panRef.current.tracking = false;
      panRef.current.active = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useLayoutEffect(() => {
    if (!graphContainerRef.current) return;
    const { width, height } = graphContainerRef.current.getBoundingClientRect();
    const { w, h } = canvasSizeRef.current;
    setPan({
      x: Math.round((width - w) / 2) - 24,
      y: Math.max(0, Math.round((height - h) / 2)) - 24,
    });
  }, []);

  const handleGraphMouseDown = useCallback((e) => {
    panRef.current = { tracking: true, active: false, startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y };
  }, [pan]);

  const nodeMap = useMemo(() => buildNodeMap(nodes), [nodes]);

  // selected can be a committed node OR an explored suggestion; null when nothing is selected
  const selected = selectedId != null ? (nodeMap.get(selectedId) ?? suggestions.get(selectedId)) : null;

  const mainChain = useMemo(
    () => nodes.filter((n) => n.kind === "main").sort((a, b) => a.id.localeCompare(b.id)),
    [nodes],
  );

  // Walk up through both committed nodes and suggestions
  const selectedPath = useMemo(() => {
    const path = [];
    let cur = selectedId;
    while (cur) {
      path.unshift(cur);
      const node = nodeMap.get(cur) ?? suggestions.get(cur);
      if (!node?.parentId) break;
      cur = node.parentId;
    }
    return path;
  }, [selectedId, nodeMap, suggestions]);

  // Walk from selectedId upward through suggestions to find the committed ancestor.
  // chain = ordered list from committed parent's child down to selectedId.
  const suggestionChain = useMemo(() => {
    const chain = [];
    let cur = selectedId;
    while (suggestions.has(cur)) {
      chain.unshift(suggestions.get(cur));
      cur = suggestions.get(cur).parentId;
    }
    return { committedParentId: cur, chain };
  }, [selectedId, suggestions]);

  const { committedParentId: suggParentId, chain: suggChain } = suggestionChain;
  const isExploringChain = suggChain.length > 0;

  // Select a committed node — clears any open suggestion exploration
  const handleSelect = (id) => {
    if (nodeMap.has(id)) setSuggestions(new Map());
    setSelectedId(id);
  };

  // Explore a suggestion: add to suggestions map and navigate to it without committing
  const handleExploreSuggestion = useCallback((nodeData, parentId) => {
    const { id } = nodeData;
    setSuggestions((prev) => {
      if (prev.has(id)) return prev; // already explored, just navigate
      const next = new Map(prev);
      next.set(id, {
        id,
        title: nodeData.title,
        text: nodeData.text ?? "A new path to explore.",
        parentId,
        kind: "branch",
        // Give this suggestion 3 placeholder children to continue exploring
        options: Array.from({ length: 3 }, (_, i) => ({
          id: `${id}-ph-${i}`,
          title: `Option ${i + 1}`,
          text: "A possible continuation.",
        })),
      });
      return next;
    });
    setSelectedId(id);
  }, []);

  // Commit the full suggestion chain (root → selected) into the permanent tree
  const handleApply = useCallback(() => {
    if (!suggChain.length) return;
    setNodes((prev) => {
      let result = prev;
      for (const sug of suggChain) {
        const { id, title, text, parentId, options } = sug;
        // Register as an option on the parent if not already there
        result = result.map((n) =>
          n.id === parentId && !n.options?.find((o) => o.id === id)
            ? { ...n, options: [...(n.options ?? []), { id, title, text }] }
            : n,
        );
        // Add the node itself
        if (!result.find((n) => n.id === id)) {
          result = [...result, { id, title, text, parentId, kind: "branch", options }];
        }
      }
      return result;
    });
    setSuggestions((prev) => {
      const next = new Map(prev);
      suggChain.forEach((s) => next.delete(s.id));
      return next;
    });
    // selectedId stays — it is now a committed green node
  }, [suggChain]);

  const handleEditTitle = (v) => {
    if (nodeMap.has(selectedId))
      setNodes((p) => p.map((n) => (n.id === selectedId ? { ...n, title: v } : n)));
    else if (suggestions.has(selectedId))
      setSuggestions((p) => { const m = new Map(p); m.set(selectedId, { ...m.get(selectedId), title: v }); return m; });
  };

  const handleEditText = (v) => {
    if (nodeMap.has(selectedId))
      setNodes((p) => p.map((n) => (n.id === selectedId ? { ...n, text: v } : n)));
    else if (suggestions.has(selectedId))
      setSuggestions((p) => { const m = new Map(p); m.set(selectedId, { ...m.get(selectedId), text: v }); return m; });
  };

  // New Beat: immediately committed green node, linked to the current context parent
  const handleNewBeat = () => {
    const parentId = selectedId;
    const id = `beat-${Date.now()}`;
    const n = nodes.filter((n) => n.kind === "branch").length + 1;
    const newNode = {
      id,
      title: `New Beat ${n}`,
      text: "A new story beat.",
      parentId,
      kind: "branch",
      options: Array.from({ length: 3 }, (_, i) => ({
        id: `${id}-ph-${i}`,
        title: `Option ${i + 1}`,
        text: "A possible continuation.",
      })),
    };
    setNodes((p) => [
      ...p.map((n) =>
        n.id === parentId
          ? { ...n, options: [...n.options, { id, title: newNode.title, text: newNode.text }] }
          : n,
      ),
      newNode,
    ]);
    setSuggestions(new Map());
    setSelectedId(id);
  };

  // ── Graph layout: leaf-centered tree layout ───────────────────────────────
  const graphElements = [];
  const NODE_H = 112;
  const mainStartY = 40;
  const mainGap = 165;
  const SLOT_W = 270;    // center-to-center spacing between adjacent leaf columns
  const MARGIN_X = 125;  // left padding so the first node is not clipped

  // Build committed parent→children map. Branch nodes first, main-chain nodes last
  // so that the main chain stays on the right and branches fan out to the left.
  const committedChildrenOf = new Map();
  nodes.forEach(node => {
    if (!node.parentId) return;
    if (!committedChildrenOf.has(node.parentId)) committedChildrenOf.set(node.parentId, []);
    committedChildrenOf.get(node.parentId).push(node);
  });
  for (const children of committedChildrenOf.values()) {
    children.sort((a, b) => (a.kind === "main" ? 1 : 0) - (b.kind === "main" ? 1 : 0));
  }

  // DFS leaf-ordering: leaves get sequential x slots; internal nodes center over children.
  const nodePositions = new Map();
  let leafIndex = 0;
  function layoutNode(nodeId, depth) {
    const children = committedChildrenOf.get(nodeId) || [];
    if (children.length === 0) {
      nodePositions.set(nodeId, { x: MARGIN_X + leafIndex * SLOT_W, y: mainStartY + depth * mainGap });
      leafIndex++;
      return;
    }
    children.forEach(ch => layoutNode(ch.id, depth + 1));
    const xs = children.map(ch => nodePositions.get(ch.id).x);
    nodePositions.set(nodeId, {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: mainStartY + depth * mainGap,
    });
  }
  const rootNode = nodes.find(n => !n.parentId);
  if (rootNode) layoutNode(rootNode.id, 0);

  // Slot list for a node: committed options first, then non-committed, then placeholders up to max.
  function slotsFor(node, hasSucc) {
    const existing = node.options.filter(o => nodeMap.has(o.id));
    const suggest = node.options.filter(o => !nodeMap.has(o.id));
    const maxTotal = hasSucc ? 2 : 3;
    const maxSuggest = Math.max(0, maxTotal - existing.length);
    const real = suggest.slice(0, maxSuggest);
    const phStart = existing.length + real.length;
    const placeholders = Array.from({ length: Math.max(0, maxSuggest - real.length) }, (_, i) => ({
      id: `${node.id}-ph-${phStart + i}`,
      title: `Option ${phStart + i + 1}`,
      text: "A new path to explore.",
      parentId: node.id,
      kind: "branch",
    }));
    return [...existing, ...real, ...placeholders];
  }

  // ── PHASE 1: All committed nodes and edges ────────────────────────────────
  nodes.forEach(node => {
    const pos = nodePositions.get(node.id);
    if (!pos) return;
    graphElements.push({ type: "node", node, x: pos.x, y: pos.y, isSuggestion: false });
    if (node.parentId) {
      const parentPos = nodePositions.get(node.parentId);
      if (parentPos) {
        const solid = node.kind === "main" && nodeMap.get(node.parentId)?.kind === "main";
        graphElements.push({ type: solid ? "line" : "connector",
          x1: parentPos.x, y1: parentPos.y + NODE_H, x2: pos.x, y2: pos.y });
      }
    }
  });

  // ── PHASE 2: Non-committed slots below the selected node only ─────────────
  if (!isExploringChain && selected) {
    const selPos = nodePositions.get(selectedId);
    if (selPos) {
      const isMainSel = selected.kind === "main";
      const mainIdx = isMainSel ? mainChain.findIndex(n => n.id === selectedId) : -1;
      const ctxHasSucc = isMainSel && mainIdx < mainChain.length - 1;
      const slots = slotsFor(selected, ctxHasSucc);
      const nonCommitted = slots.filter(s => !nodeMap.has(s.id));
      if (nonCommitted.length > 0) {
        const committedChildXs = (committedChildrenOf.get(selectedId) || [])
          .map(c => nodePositions.get(c.id)?.x).filter(x => x != null);
        const rightEdge = committedChildXs.length > 0 ? Math.max(...committedChildXs) : null;
        const bY = selPos.y + mainGap;
        nonCommitted.forEach((slot, i) => {
          const bx = rightEdge != null
            ? rightEdge + (i + 1) * SLOT_W
            : selPos.x + (i - (nonCommitted.length - 1) / 2) * SLOT_W;
          graphElements.push({ type: "connector", x1: selPos.x, y1: selPos.y + NODE_H, x2: bx, y2: bY });
          graphElements.push({ type: "node", node: slot, x: bx, y: bY, isSuggestion: true, parentId: selectedId });
        });
      }
    }
  }

  // ── PHASE 3: Suggestion chain ─────────────────────────────────────────────
  if (isExploringChain) {
    const cpNode = nodeMap.get(suggParentId);
    const cpPos = nodePositions.get(suggParentId);
    if (cpNode && cpPos) {
      const committedChildXs = (committedChildrenOf.get(suggParentId) || [])
        .map(c => nodePositions.get(c.id)?.x).filter(x => x != null);
      const chainX = committedChildXs.length > 0 ? Math.max(...committedChildXs) + SLOT_W : cpPos.x;

      const posList = [];
      suggChain.forEach((sug, d) => {
        const px = chainX;
        const py = cpPos.y + (d + 1) * mainGap;
        const prevX = d === 0 ? cpPos.x : posList[d - 1].x;
        const prevY = d === 0 ? cpPos.y : posList[d - 1].y;
        graphElements.push({ type: "connector", x1: prevX, y1: prevY + NODE_H, x2: px, y2: py });
        posList.push({ x: px, y: py });
        graphElements.push({ type: "node", node: sug, x: px, y: py, isSuggestion: true, parentId: sug.parentId });
      });

      const deepSug = suggChain[suggChain.length - 1];
      const deepPos = posList[posList.length - 1];
      const childY = deepPos.y + mainGap;
      const numOpts = deepSug.options.length;
      deepSug.options.forEach((opt, i) => {
        const cx = deepPos.x + (i - (numOpts - 1) / 2) * SLOT_W;
        const explored = suggestions.get(opt.id);
        const childNode = explored ?? {
          id: opt.id, title: opt.title,
          text: opt.text ?? "A possible continuation.",
          parentId: deepSug.id, kind: "branch",
        };
        graphElements.push({ type: "connector", x1: deepPos.x, y1: deepPos.y + NODE_H, x2: cx, y2: childY });
        graphElements.push({ type: "node", node: childNode, x: cx, y: childY, isSuggestion: true, parentId: deepSug.id });
      });
    }
  }

  // Dynamic canvas size to fit all nodes without clipping
  const allNodeEls = graphElements.filter(e => e.type === "node");
  const canvasW = allNodeEls.length
    ? Math.max(600, ...allNodeEls.map(e => e.x + 125))
    : 600;
  const canvasH = allNodeEls.length
    ? Math.max(500, ...allNodeEls.map(e => e.y + NODE_H + 60))
    : 500;
  canvasSizeRef.current = { w: canvasW, h: canvasH };

  const isSelectedSuggestion = suggestions.has(selectedId);

  // Sidebar options: raw options + placeholder slots to always show at least 3 choices
  const rawOpts = selected?.options ?? [];
  const sidebarOpts = [
    ...rawOpts,
    ...Array.from({ length: Math.max(0, 3 - rawOpts.length) }, (_, i) => ({
      id: `${selectedId}-ph-${rawOpts.length + i}`,
      title: `Option ${rawOpts.length + i + 1}`,
      text: "A new path to explore.",
    })),
  ];

  return (
    <div className={`min-h-screen bg-[#08111f] text-white${isDragging ? " select-none cursor-col-resize" : ""}`}>
      <div ref={containerRef} className="flex min-h-screen">

        {/* ── Left: text editor ── */}
        <section className="flex flex-col shrink-0 bg-[#0a1322]" style={{ width: leftWidth }}>
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Creative Writing Studio</div>
              <h1 className="mt-1 text-2xl font-semibold">Interactive Story Draft</h1>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              Local prototype
            </div>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <div className="flex flex-1 flex-col rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/20">
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="text-sm font-medium text-white/80">Text input</div>
                <div className="text-xs text-white/45">Seed text</div>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="flex-1 w-full resize-none bg-transparent px-4 py-4 text-[15px] leading-7 text-white/90 outline-none placeholder:text-white/25"
                spellCheck={false}
              />
            </div>
          </div>
        </section>

        {/* ── Drag divider ── */}
        <div
          onMouseDown={handleDividerMouseDown}
          className={`w-1 shrink-0 cursor-col-resize transition-colors ${isDragging ? "bg-sky-400/60" : "bg-white/10 hover:bg-white/30"}`}
        />

        {/* ── Right: graph + details sidebar ── */}
        <section className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.12),transparent_24%),#09111c]">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Node graph</div>
              <h2 className="mt-1 text-xl font-semibold">Story beats and branches</h2>
            </div>
            <button
              onClick={handleNewBeat}
              className="rounded-2xl border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/12"
            >
              + New Beat
            </button>
          </div>

          <div className="flex flex-1 gap-4 overflow-hidden p-5">
            {/* Graph canvas — drag to pan */}
            <div
              ref={graphContainerRef}
              className="relative min-w-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] cursor-grab active:cursor-grabbing"
              onMouseDown={handleGraphMouseDown}
            >
              <div style={{ transform: `translate(${pan.x + 24}px, ${pan.y + 24}px)`, position: "absolute", top: 0, left: 0 }}>
                <svg style={{ position: "absolute", top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: "none" }}>
                  {graphElements
                    .filter((item) => item.type !== "node")
                    .map((item, idx) =>
                      item.type === "line" || item.type === "connector" ? (
                        <line
                          key={idx}
                          x1={item.x1} y1={item.y1}
                          x2={item.x2} y2={item.y2}
                          stroke="rgba(255,255,255,0.18)"
                          strokeWidth="2"
                          strokeDasharray={item.type === "connector" ? "8 6" : "0"}
                        />
                      ) : null,
                    )}
                </svg>

                <div className="relative" style={{ width: canvasW, height: canvasH }}>
                  {graphElements.map((item, idx) =>
                    item.type === "node" ? (
                      <NodePill
                        key={item.node.id + idx}
                        node={item.node}
                        selected={item.node.id === selectedId}
                        isSuggestion={item.isSuggestion}
                        x={item.x}
                        y={item.y}
                        onClick={
                          item.isSuggestion
                            ? () => handleExploreSuggestion(item.node, item.parentId ?? item.node.parentId)
                            : () => handleSelect(item.node.id)
                        }
                      />
                    ) : null,
                  )}
                </div>
              </div>
            </div>

            {/* Details sidebar */}
            {selected && (
              <div className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">

                {/* Apply banner — only shown when exploring a suggestion chain */}
                {isSelectedSuggestion && (
                  <div className="rounded-2xl border border-violet-400/30 bg-violet-500/[0.08] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-violet-300/70">Suggestion path</div>
                    <p className="mt-1 text-sm text-white/60">
                      {suggChain.length === 1
                        ? "This node isn't in the story yet."
                        : `${suggChain.length} nodes pending.`}
                    </p>
                    <button
                      onClick={handleApply}
                      className="mt-3 w-full rounded-xl border border-violet-400/40 bg-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/40"
                    >
                      Apply to tree
                    </button>
                  </div>
                )}

                {/* Node details — title + text editable */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`rounded-full border px-3 py-1 text-sm ${
                        isSelectedSuggestion
                          ? "border-violet-400/30 bg-violet-500/15 text-violet-200"
                          : "border-sky-400/30 bg-sky-500/15 text-sky-200"
                      }`}
                    >
                      {selected.title}
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/50">
                      Depth {selectedPath.length}
                    </div>
                  </div>

                  <div className="mt-4 text-xs uppercase tracking-[0.2em] text-white/45">Title</div>
                  <input
                    value={selected.title}
                    onChange={(e) => handleEditTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white outline-none transition-colors focus:border-sky-400/50 focus:bg-white/[0.07]"
                  />

                  <div className="mt-3 text-xs uppercase tracking-[0.2em] text-white/45">Description</div>
                  <textarea
                    value={selected.text}
                    onChange={(e) => handleEditText(e.target.value)}
                    rows={4}
                    className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-6 text-white/85 outline-none transition-colors focus:border-sky-400/50 focus:bg-white/[0.07]"
                  />
                </div>

                {/* Next options */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/45">Next options</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {sidebarOpts.map((opt) => {
                      const isCommitted = nodeMap.has(opt.id);
                      const isExplored = suggestions.has(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            if (isCommitted) handleSelect(opt.id);
                            else if (isExplored) setSelectedId(opt.id);
                            else handleExploreSuggestion(opt, selected.id);
                          }}
                          className={`rounded-2xl border p-3 text-left transition ${
                            isCommitted
                              ? "border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/15"
                              : isExplored
                                ? "border-violet-400/40 bg-violet-500/10 hover:bg-violet-500/15"
                                : "border-white/10 bg-white/[0.03] hover:border-violet-400/30 hover:bg-violet-500/10"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{opt.title}</div>
                            <div className="text-xs text-white/40">
                              {isCommitted ? "Go to" : isExplored ? "Exploring" : "Explore"}
                            </div>
                          </div>
                          <div className="mt-1 text-sm leading-5 text-white/60">{opt.text}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
