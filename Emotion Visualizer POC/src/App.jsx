import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import nrcLexicon from "./nrc_emotions.json";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Brain,
  Eye,
  Flame,
  Frown,
  Loader2,
  Meh,
  RefreshCw,
  ShieldAlert,
  Smile,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";

// ─── Emotion definitions ──────────────────────────────────────────────────────

const EMOTIONS = [
  { key: "joy",          label: "Joy",          icon: Smile,       color: "from-amber-300 to-yellow-500",  ring: "ring-yellow-400/30",  bg: "bg-yellow-400/10"  },
  { key: "trust",        label: "Trust",        icon: ShieldAlert, color: "from-emerald-300 to-teal-500",  ring: "ring-emerald-400/30", bg: "bg-emerald-400/10" },
  { key: "anticipation", label: "Anticipation", icon: Sparkles,    color: "from-fuchsia-300 to-pink-500",  ring: "ring-fuchsia-400/30", bg: "bg-fuchsia-400/10" },
  { key: "surprise",     label: "Surprise",     icon: Eye,         color: "from-cyan-300 to-sky-500",      ring: "ring-cyan-400/30",    bg: "bg-cyan-400/10"    },
  { key: "anger",        label: "Anger",        icon: Flame,       color: "from-rose-300 to-red-500",      ring: "ring-rose-400/30",    bg: "bg-rose-400/10"    },
  { key: "fear",         label: "Fear",         icon: ShieldAlert, color: "from-violet-300 to-purple-500", ring: "ring-violet-400/30",  bg: "bg-violet-400/10"  },
  { key: "sadness",      label: "Sadness",      icon: Frown,       color: "from-slate-300 to-slate-500",   ring: "ring-slate-400/30",   bg: "bg-slate-400/10"   },
  { key: "disgust",      label: "Disgust",      icon: Meh,         color: "from-lime-300 to-green-500",    ring: "ring-lime-400/30",    bg: "bg-lime-400/10"    },
];

// Model outputs these labels — map to our emotion keys.
// "love" is folded into joy (nearest NRC equivalent).
// trust & anticipation aren't in the model.
const TF_LABEL_MAP = {
  sadness:  "sadness",
  joy:      "joy",
  love:     "joy",
  anger:    "anger",
  fear:     "fear",
  surprise: "surprise",
};
const TF_SUPPORTED = new Set(Object.values(TF_LABEL_MAP));

// ─── NRC helpers ─────────────────────────────────────────────────────────────

const NEGATIONS = new Set([
  "not", "never", "no", "neither", "nor", "nobody", "nothing", "nowhere",
  "cannot", "can't", "won't", "don't", "doesn't", "didn't", "isn't",
  "wasn't", "weren't", "hadn't", "hasn't", "haven't", "wouldn't", "couldn't",
  "shouldn't", "hardly", "barely", "scarcely",
]);

const SAMPLE_TEXT = `The room felt warm and promising, like something good was about to happen.\n\nThen the phone rang suddenly, and my stomach tightened.\n\nI laughed at the absurdity of it all, even as the memory of the argument returned.\n\nBy morning, the silence felt strangely safe.`;

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenize(sentence) {
  return sentence.toLowerCase().match(/[a-z']+/g) || [];
}

function analyzeWithNRC(sentence) {
  const words = tokenize(sentence);
  const counts = Object.fromEntries(EMOTIONS.map((e) => [e.key, 0]));

  for (let i = 0; i < words.length; i++) {
    const emotions = nrcLexicon[words[i]];
    if (!emotions) continue;
    const negated = words.slice(Math.max(0, i - 3), i).some((w) => NEGATIONS.has(w));
    for (const emotion of emotions) {
      counts[emotion] = negated
        ? Math.max(0, counts[emotion] - 0.5)
        : counts[emotion] + 1;
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  let dominant = "neutral";
  let dominantScore = 0;
  for (const e of EMOTIONS) {
    if (counts[e.key] > dominantScore) { dominant = e.key; dominantScore = counts[e.key]; }
  }
  const ranked = [...EMOTIONS]
    .map((e) => ({ ...e, score: counts[e.key], share: total ? counts[e.key] / total : 0 }))
    .sort((a, b) => b.score - a.score);

  const secondScore = ranked[1]?.score || 0;
  const dominance = total > 0 ? (dominantScore - secondScore) / total : 0;
  const density = dominantScore / Math.max(5, words.length);
  const confidence = total > 0
    ? Math.min(0.95, Math.max(0.35, 0.35 + dominance * 0.4 + density * 1.5))
    : 0.35;

  return { sentence, counts, ranked, dominant, dominantScore, confidence, total };
}

function transformerToSentenceResult(sentence, scores) {
  const counts = Object.fromEntries(EMOTIONS.map((e) => [e.key, 0]));
  for (const { label, score } of scores) {
    const key = TF_LABEL_MAP[label];
    if (key) counts[key] += score; // accumulate (e.g. joy + love → joy)
  }
  let dominant = "neutral";
  let dominantScore = 0;
  for (const e of EMOTIONS) {
    if (counts[e.key] > dominantScore) { dominant = e.key; dominantScore = counts[e.key]; }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const ranked = [...EMOTIONS]
    .map((e) => ({ ...e, score: counts[e.key], share: total ? counts[e.key] / total : 0 }))
    .sort((a, b) => b.score - a.score);
  return { sentence, counts, ranked, dominant, dominantScore, confidence: dominantScore, total };
}

function buildAnalysisBundle(results) {
  const totals = Object.fromEntries(EMOTIONS.map((e) => [e.key, 0]));
  for (const r of results) {
    for (const e of EMOTIONS) totals[e.key] += r.counts[e.key] || 0;
  }
  const dominantOverall =
    [...EMOTIONS].map((e) => ({ ...e, score: totals[e.key] })).sort((a, b) => b.score - a.score)[0]
    || emotionMeta("neutral");
  return {
    results,
    totals,
    dominantOverall,
    sentenceCount: results.length,
    avgConfidence: results.length
      ? results.reduce((a, r) => a + r.confidence, 0) / results.length
      : 0,
  };
}

function emotionMeta(key) {
  return EMOTIONS.find((e) => e.key === key) || {
    key: "neutral", label: "Neutral", icon: Meh,
    color: "from-slate-500 to-slate-700", ring: "ring-slate-500/30", bg: "bg-slate-500/10",
  };
}

function classNames(...xs) { return xs.filter(Boolean).join(" "); }

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [text, setText]             = useState(SAMPLE_TEXT);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode]             = useState("nrc");

  // Worker state
  const workerRef    = useRef(null);
  const classifyIdRef = useRef(0);
  const [modelStatus, setModelStatus]     = useState("idle"); // idle | loading | ready | error
  const [modelProgress, setModelProgress] = useState({ file: "", pct: 0 });

  // Transformer results
  const [tfResults, setTfResults] = useState(null);
  const [tfLoading, setTfLoading] = useState(false);
  const [tfError, setTfError]     = useState(null);

  // Boot the worker the first time transformer mode is activated
  useEffect(() => {
    if (mode !== "transformer") return;
    if (workerRef.current) return;

    const worker = new Worker(
      new URL("./transformerWorker.js", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (e) => {
      const { type, data, id, results, message } = e.data;

      if (type === "progress") {
        if (data.status === "downloading" || data.status === "fetching") {
          setModelProgress({
            file: data.file?.split("/").pop() ?? "",
            pct: Math.round(data.progress ?? 0),
          });
        }
      } else if (type === "ready") {
        setModelStatus("ready"); // from here on the model is cached — no token needed
        setModelProgress({ file: "", pct: 100 });
      } else if (type === "load_error") {
        setModelStatus("error");
        setTfError(message);
      } else if (type === "result") {
        if (id === classifyIdRef.current) {
          const sentenceResults = results.map((scores, i) =>
            transformerToSentenceResult(splitSentences(text)[i] ?? "", scores)
          );
          setTfResults(buildAnalysisBundle(sentenceResults));
          setTfLoading(false);
        }
      } else if (type === "classify_error") {
        if (id === classifyIdRef.current) {
          setTfError(message);
          setTfLoading(false);
        }
      }
    };

    workerRef.current = worker;
    setModelStatus("loading");
    worker.postMessage({ type: "load" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Re-classify whenever text changes (debounced) or model becomes ready
  useEffect(() => {
    if (mode !== "transformer" || modelStatus !== "ready") return;

    const sentences = splitSentences(text);
    if (!sentences.length) { setTfResults(null); return; }

    setTfLoading(true);
    setTfError(null);

    const id = ++classifyIdRef.current;
    const timer = setTimeout(() => {
      workerRef.current?.postMessage({ type: "classify", id, sentences });
    }, 400);

    return () => clearTimeout(timer);
  }, [text, mode, modelStatus]);

  // Clear transformer state when leaving transformer mode
  useEffect(() => {
    if (mode !== "transformer") {
      setTfResults(null);
      setTfError(null);
    }
  }, [mode]);

  const nrcAnalysis = useMemo(
    () => buildAnalysisBundle(splitSentences(text).map(analyzeWithNRC)),
    [text]
  );

  const analysis = mode === "transformer" && tfResults ? tfResults : nrcAnalysis;
  const active   = analysis.results[activeIndex] || analysis.results[0];
  const barMax   = Math.max(1, ...EMOTIONS.map((e) => analysis.totals[e.key]));

  const formatTotal = (val) =>
    mode === "transformer"
      ? `${Math.round(val * 100)}%`
      : String(Math.round(val));

  return (
    <div className="h-screen overflow-hidden bg-[#07111f] text-slate-100 flex flex-col">
      <div className="flex flex-1 gap-4 p-4 overflow-hidden min-h-0">

        {/* ── Sidebar ── */}
        <aside className="w-64 flex-none flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-fuchsia-400 to-amber-300 text-slate-950 shadow-lg shadow-fuchsia-500/20">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">StoryPulse</div>
              <div className="text-xs text-slate-400">Write, scan, and feel the scene.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-3">
              <Brain className="h-3.5 w-3.5 text-fuchsia-300" />
              Emotional overview
              {tfLoading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-fuchsia-400" />}
            </div>
            <div className="space-y-2.5">
              {EMOTIONS.map((emotion) => {
                const Icon = emotion.icon;
                const value = analysis.totals[emotion.key] || 0;
                const pct = Math.round((value / Math.max(1, barMax)) * 100);
                return (
                  <div key={emotion.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <span className={classNames("inline-flex h-6 w-6 items-center justify-center rounded-lg", emotion.bg, emotion.ring, "ring-1")}>
                          <Icon className="h-3 w-3" />
                        </span>
                        {emotion.label}
                      </div>
                      <span className="text-slate-500">{formatTotal(value)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        className={classNames("h-full rounded-full bg-gradient-to-r", emotion.color)}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-fuchsia-500/10 to-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-200 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Snapshot
            </div>
            <div className="text-xs leading-5 text-slate-300">
              {analysis.sentenceCount} sentence{analysis.sentenceCount === 1 ? "" : "s"} analyzed.{" "}
              Dominant mood:{" "}
              <span className="font-medium text-white">{emotionMeta(analysis.dominantOverall.key).label}</span>.
            </div>
          </div>

          <button
            onClick={() => setText(SAMPLE_TEXT)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Load sample passage
          </button>
        </aside>

        {/* ── Main ── */}
        <main className="flex flex-1 flex-col gap-3 overflow-hidden min-h-0">

          {/* Header bar */}
          <section className="flex-none rounded-3xl border border-white/10 bg-white/5 px-5 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Creative writing emotion studio</div>
                <h1 className="mt-0.5 text-xl font-semibold tracking-tight truncate">See the emotional arc of every sentence.</h1>
              </div>

              {/* Mode toggle */}
              <div className="flex flex-none items-center gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
                <button
                  onClick={() => setMode("nrc")}
                  className={classNames(
                    "rounded-xl px-3 py-1.5 text-xs font-medium transition",
                    mode === "nrc" ? "bg-white/10 text-white shadow" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  NRC Lexicon
                </button>
                <button
                  onClick={() => setMode("transformer")}
                  className={classNames(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition",
                    mode === "transformer" ? "bg-fuchsia-500/20 text-fuchsia-200 shadow" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {(modelStatus === "loading" || tfLoading)
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3" />}
                  Transformer
                </button>
              </div>

              <div className="flex gap-3 flex-none">
                <Stat label="Sentences" value={analysis.sentenceCount} />
                <Stat label="Avg. confidence" value={`${Math.round(analysis.avgConfidence * 100)}%`} />
                <Stat label="Top mood" value={emotionMeta(analysis.dominantOverall.key).label} />
              </div>
            </div>
          </section>

          {/* Content */}
          <div className="flex flex-1 gap-3 overflow-hidden min-h-0">

            {/* Left column */}
            <div className="flex flex-1 flex-col gap-3 overflow-hidden min-h-0">

              {/* Textarea */}
              <div className="flex-none rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <div className="text-sm font-medium text-slate-300">Your text</div>
                    <div className="text-xs text-slate-500">Write naturally — sentences are analyzed in real time.</div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-slate-400">
                    <Zap className="h-3.5 w-3.5 text-amber-300" />
                    Real-time
                  </div>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your story here..."
                  className="w-full h-32 rounded-2xl border border-white/10 bg-[#081423] p-4 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/40 focus:ring-2 focus:ring-fuchsia-500/20 resize-none"
                />
              </div>

              {/* Sentence list */}
              <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl overflow-y-auto min-h-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-slate-300">Dominant emotion by sentence</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    {mode === "transformer" ? (
                      <><Sparkles className="h-3 w-3 text-fuchsia-400" /><span className="text-fuchsia-400">DistilBERT</span></>
                    ) : (
                      <><Brain className="h-3 w-3" />NRC Lexicon</>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mb-3">Click any sentence to inspect the breakdown.</div>

                {/* Model loading / error states */}
                <AnimatePresence>
                  {mode === "transformer" && modelStatus === "loading" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mb-3 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2 text-xs text-fuchsia-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading model ({modelProgress.pct}%)
                        {modelProgress.file && (
                          <span className="ml-auto text-slate-500 truncate max-w-[160px]">{modelProgress.file}</span>
                        )}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-indigo-400"
                          animate={{ width: `${modelProgress.pct}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </motion.div>
                  )}
                  {mode === "transformer" && modelStatus === "idle" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"
                    >
                      <p className="text-xs font-medium text-amber-300 mb-1">Model not downloaded yet</p>
                      <p className="text-xs text-slate-400 leading-5">
                        Run this once in your terminal to download the model locally:
                      </p>
                      <code className="mt-2 block rounded-lg bg-black/30 px-3 py-2 text-xs text-slate-300 font-mono">
                        node scripts/download-model.js &lt;HF_TOKEN&gt;
                      </code>
                      <p className="mt-2 text-xs text-slate-500">
                        Get a free token at hf.co/settings/tokens — then reload this page.
                      </p>
                    </motion.div>
                  )}
                  {tfError && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
                    >
                      <span>{tfError}</span>
                      <button
                        onClick={() => {
                          setTfError(null);
                          if (workerRef.current && modelStatus === "ready") {
                            const sentences = splitSentences(text);
                            const id = ++classifyIdRef.current;
                            setTfLoading(true);
                            workerRef.current.postMessage({ type: "classify", id, sentences });
                          }
                        }}
                        className="flex-none flex items-center gap-1 rounded-lg border border-rose-500/30 px-2 py-1 hover:bg-rose-500/10 transition"
                      >
                        <RefreshCw className="h-3 w-3" /> Retry
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid gap-2">
                  {analysis.results.length ? (
                    analysis.results.map((result, index) => {
                      const emotion = emotionMeta(result.dominant);
                      const Icon = emotion.icon;
                      const score = Math.round(result.confidence * 100);
                      const isActive = index === activeIndex;
                      return (
                        <motion.button
                          key={`${index}-${result.sentence}`}
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setActiveIndex(index)}
                          className={classNames(
                            "w-full rounded-2xl border p-3 text-left transition",
                            isActive
                              ? "border-fuchsia-400/40 bg-white/8 shadow-lg shadow-fuchsia-500/10"
                              : "border-white/10 bg-black/20 hover:bg-white/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={classNames("mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl ring-1", emotion.bg, emotion.ring)}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-200">
                                  #{index + 1}
                                </span>
                                <span className={classNames("rounded-full bg-gradient-to-r px-2 py-0.5 text-xs font-medium text-slate-950", emotion.color)}>
                                  {emotion.label}
                                </span>
                                <span className="text-xs text-slate-500">{score}% confidence</span>
                              </div>
                              <p className="mt-1.5 line-clamp-1 text-xs leading-5 text-slate-300">{result.sentence}</p>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                                <div
                                  className={classNames("h-full rounded-full bg-gradient-to-r", emotion.color)}
                                  style={{ width: `${Math.max(18, score)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })
                  ) : (
                    <EmptyState />
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="flex w-[380px] flex-none flex-col gap-3 overflow-hidden min-h-0">

              {/* Active sentence detail */}
              <div className="flex-none rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
                <div className="text-sm font-medium text-slate-300 mb-2">Active sentence</div>
                {active ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-sm leading-6 text-slate-100 line-clamp-2">{active.sentence}</p>
                    </div>
                    <div className={classNames("rounded-2xl border p-3", emotionMeta(active.dominant).bg, emotionMeta(active.dominant).ring, "border-white/10")}>
                      <div className="flex items-center gap-3">
                        {(() => {
                          const m = emotionMeta(active.dominant);
                          const Icon = m.icon;
                          return (
                            <span className={classNames("inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl ring-1", m.bg, m.ring)}>
                              <Icon className="h-5 w-5" />
                            </span>
                          );
                        })()}
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Dominant emotion</div>
                          <div className="text-xl font-semibold tracking-tight">{emotionMeta(active.dominant).label}</div>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-xs text-slate-400">Confidence</div>
                          <div className="text-xl font-semibold">{Math.round(active.confidence * 100)}%</div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className={classNames("h-full rounded-full bg-gradient-to-r", emotionMeta(active.dominant).color)}
                          style={{ width: `${Math.round(active.confidence * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Emotion distribution */}
              <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl overflow-y-auto min-h-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-slate-300">Distribution across passage</div>
                  {mode === "transformer" && (
                    <span className="text-xs text-slate-500">Trust &amp; Anticipation not in model</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mb-3">Visual summary of the whole text.</div>
                <div className="grid gap-2 grid-cols-2">
                  {EMOTIONS.map((emotion) => {
                    const value = analysis.totals[emotion.key] || 0;
                    const pct = Math.round((value / barMax) * 100);
                    const Icon = emotion.icon;
                    const unavailable = mode === "transformer" && !TF_SUPPORTED.has(emotion.key);
                    return (
                      <div
                        key={emotion.key}
                        className={classNames("rounded-2xl border border-white/10 bg-black/20 p-3 transition", unavailable && "opacity-35")}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={classNames("inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg ring-1", emotion.bg, emotion.ring)}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-200 truncate">{emotion.label}</div>
                            <div className="text-xs text-slate-500">{unavailable ? "n/a" : formatTotal(value)}</div>
                          </div>
                          <div className="ml-auto text-xs text-slate-400">{unavailable ? "—" : `${pct}%`}</div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div
                            className={classNames("h-full rounded-full bg-gradient-to-r", emotion.color)}
                            style={{ width: unavailable ? "0%" : `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-tight text-white">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-slate-400">
      No sentences found yet. Try adding a few lines with punctuation.
    </div>
  );
}
