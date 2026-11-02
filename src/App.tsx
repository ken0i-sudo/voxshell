import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Terminal,
  ShieldCheck,
  RotateCcw,
  FolderSync,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Keyboard,
  Cpu,
  Lock,
  Sparkles,
  Play,
  Code2,
} from "lucide-react";

type PillState =
  | "LISTENING"
  | "PROCESSING"
  | "YELLOW_AUTH"
  | "RED_AUTH"
  | "EXECUTING"
  | "COMPLETED";

interface Scenario {
  id: string;
  label: string;
  badge: string;
  tier: "YELLOW" | "RED";
  transcript: string;
  actionType: "APP_INSTALL" | "FILE_MOVE" | "FILE_DELETE";
  summary: string;
  cliPreview: string;
  uacNotice?: string;
  packageInfo?: {
    name: string;
    id: string;
    version: string;
    source: string;
  };
  files?: { name: string; size: string; path: string }[];
  totalSize?: string;
  isLargeDelete?: boolean;
}

const PRESET_SCENARIOS: Scenario[] = [
  {
    id: "discord",
    label: "Install Discord",
    badge: "Yellow Tier • winget",
    tier: "YELLOW",
    transcript: "Hey, can you download Discord for me?",
    actionType: "APP_INSTALL",
    summary: "Install Discord (Per-User Silent Scope)",
    cliPreview:
      "winget install --id Discord.Discord --exact --scope user --silent --accept-package-agreements",
    packageInfo: {
      name: "Discord",
      id: "Discord.Discord",
      version: "1.0.9168",
      source: "winget (Official Verified)",
    },
  },
  {
    id: "move_pdfs",
    label: "Organize PDFs",
    badge: "Yellow Tier • Batch Move",
    tier: "YELLOW",
    transcript: "Move all PDFs from Downloads to Invoices in my Documents",
    actionType: "FILE_MOVE",
    summary: "Create 'Documents\\Invoices' & move 4 PDF files (6.8 MB)",
    cliPreview:
      "atomic_move_file(Downloads/*.pdf -> Documents/Invoices/) [Collision: AUTO_RENAME]",
    totalSize: "6.8 MB",
    files: [
      {
        name: "AWS_Invoice_Oct.pdf",
        size: "1.2 MB",
        path: "Downloads\\AWS_Invoice_Oct.pdf",
      },
      {
        name: "Tuition_Receipt_2026.pdf",
        size: "2.4 MB",
        path: "Downloads\\Tuition_Receipt_2026.pdf",
      },
      {
        name: "Hardware_Quote.pdf",
        size: "0.9 MB",
        path: "Downloads\\Hardware_Quote.pdf",
      },
      {
        name: "Tax_Summary_FY26.pdf",
        size: "2.3 MB",
        path: "Downloads\\Tax_Summary_FY26.pdf",
      },
    ],
  },
  {
    id: "delete_zips",
    label: "Clean Old .zip Archives",
    badge: "Red Tier • 24h Quarantine",
    tier: "RED",
    transcript: "Delete all zip files in my Downloads folder",
    actionType: "FILE_DELETE",
    summary: "Move 3 archives (2.4 GB) to Stage-1 Quarantine",
    cliPreview:
      "quarantine::stage_delete(Downloads/*.zip -> %LOCALAPPDATA%\\VoxShell\\quarantine\\cmd_9f8a\\)",
    totalSize: "2.4 GB",
    isLargeDelete: true,
    files: [
      {
        name: "old_build_artifacts.zip",
        size: "1.6 GB",
        path: "Downloads\\old_build_artifacts.zip",
      },
      {
        name: "dataset_backup_v1.zip",
        size: "620 MB",
        path: "Downloads\\dataset_backup_v1.zip",
      },
      {
        name: "temp_icons_pack.zip",
        size: "180 MB",
        path: "Downloads\\temp_icons_pack.zip",
      },
    ],
  },
];

export default function App() {
  const [activeScenario, setActiveScenario] = useState<Scenario>(
    PRESET_SCENARIOS[0],
  );
  const [pillState, setPillState] = useState<PillState>("YELLOW_AUTH");
  const [inputMode, setInputMode] = useState<"VOICE" | "TEXT">("VOICE");
  const [customQuery, setCustomQuery] = useState("");
  const [showFilesDrawer, setShowFilesDrawer] = useState(false);
  const [showCliDetails, setShowCliDetails] = useState(false);
  const [skipQuarantine, setSkipQuarantine] = useState(false);
  const [progress, setProgress] = useState(0);
  const [authTimer, setAuthTimer] = useState(30);
  const [undoneToast, setUndoneToast] = useState(false);

  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Trigger a preset scenario simulation
  const runScenario = (scenario: Scenario) => {
    setActiveScenario(scenario);
    setShowFilesDrawer(false);
    setShowCliDetails(false);
    setSkipQuarantine(false);
    setUndoneToast(false);
    setPillState("LISTENING");

    setTimeout(() => {
      setPillState("PROCESSING");
    }, 1100);

    setTimeout(() => {
      setAuthTimer(30);
      setPillState(scenario.tier === "RED" ? "RED_AUTH" : "YELLOW_AUTH");
    }, 2100);
  };

  // Focus Cancel button by default on Red Tier (URS US-05 requirement)
  useEffect(() => {
    if (pillState === "RED_AUTH") {
      cancelBtnRef.current?.focus();
    }
  }, [pillState]);

  // 30-second countdown for AWAITING_AUTH states (URS UFR-2)
  useEffect(() => {
    if (pillState !== "YELLOW_AUTH" && pillState !== "RED_AUTH") return;
    const interval = setInterval(() => {
      setAuthTimer((prev) => {
        if (prev <= 1) {
          setPillState("LISTENING");
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pillState]);

  // Simulate Execution progress
  const handleApprove = () => {
    setPillState("EXECUTING");
    setProgress(0);
    const step = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(step);
          setPillState("COMPLETED");
          return 100;
        }
        return prev + 25;
      });
    }, 220);
  };

  const handleUndo = () => {
    setUndoneToast(true);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim()) return;
    const lower = customQuery.toLowerCase();
    if (
      lower.includes("delete") ||
      lower.includes("remove") ||
      lower.includes("zip")
    ) {
      runScenario({ ...PRESET_SCENARIOS[2], transcript: customQuery });
    } else if (
      lower.includes("move") ||
      lower.includes("pdf") ||
      lower.includes("folder")
    ) {
      runScenario({ ...PRESET_SCENARIOS[1], transcript: customQuery });
    } else {
      runScenario({ ...PRESET_SCENARIOS[0], transcript: customQuery });
    }
    setCustomQuery("");
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 selection:bg-indigo-500/30">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-[130px]" />
        <div className="absolute top-96 left-1/4 h-[360px] w-[460px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      {/* Sticky Glassmorphic Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Terminal className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              VoxShell
            </span>
            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
              Tauri v2 • Rust
            </span>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#simulator" className="transition hover:text-white">
              Live Overlay Demo
            </a>
            <a href="#security" className="transition hover:text-white">
              Zero-Trust Sandbox
            </a>
            <a href="#architecture" className="transition hover:text-white">
              SQLite Rollback
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="#download"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-200"
            >
              <Download className="h-4 w-4" />
              Download MVP
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative mx-auto max-w-6xl px-6 pt-16 pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>Press</span>
            <kbd className="rounded border border-white/20 bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-white">
              Alt + Space
            </kbd>
            <span>to command Windows & Linux by voice</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            The Power of the Terminal.{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              The Speed of Your Voice.
            </span>
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-zinc-400">
            Install apps via <code className="text-zinc-200">winget</code>,
            batch-organize messy folders, and clean up disk space without
            memorizing a single flag. Built in Rust with a discrete folder-block
            sandbox and 1-step transactional Undo.
          </p>
        </div>

        {/* ================================================================= */}
        {/* INTERACTIVE OVERLAY PILL SIMULATOR (Directly reusable in Tauri)   */}
        {/* ================================================================= */}
        <section id="simulator" className="mt-12">
          {/* Scenario Selector Bar */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Try a Voice Command:
            </span>
            {PRESET_SCENARIOS.map((s) => {
              const active = activeScenario.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => runScenario(s)}
                  className={`group flex items-center gap-2.5 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "border-indigo-500/60 bg-indigo-500/15 text-white shadow-lg shadow-indigo-500/10"
                      : "border-white/10 bg-zinc-900/70 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                  }`}
                >
                  <Play className="h-3.5 w-3.5 text-indigo-400" />
                  <span>"{s.transcript}"</span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      s.tier === "RED"
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {s.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Simulated Desktop Monitor Frame */}
          <div className="relative mx-auto max-w-2xl rounded-3xl border border-white/15 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
            <div className="mb-4 flex items-center justify-between text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono">
                  voxshell://overlay • State:{" "}
                  <strong className="text-zinc-300">{pillState}</strong>
                </span>
              </div>
              <button
                onClick={() =>
                  setInputMode((m) => (m === "VOICE" ? "TEXT" : "VOICE"))
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/10"
              >
                <Keyboard className="h-3.5 w-3.5" />
                {inputMode === "VOICE"
                  ? "Press Tab to Type"
                  : "Switch to Voice"}
              </button>
            </div>

            {/* Top Floating Pill Bar */}
            <div className="rounded-2xl border border-white/15 bg-[#11131c] p-4 shadow-inner">
              {inputMode === "TEXT" ? (
                <form
                  onSubmit={handleTextSubmit}
                  className="flex items-center gap-3"
                >
                  <Terminal className="h-5 w-5 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    placeholder="Type a command (e.g., 'move all pdfs in downloads to documents')..."
                    className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    Dry-Run
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <button
                      onClick={() => runScenario(activeScenario)}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                        pillState === "LISTENING"
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 animate-pulse"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                      title="Replay Voice Capture"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                    <div>
                      <p className="text-xs font-medium text-zinc-400">
                        {pillState === "LISTENING"
                          ? "Listening... (VAD Auto-Stop active)"
                          : pillState === "PROCESSING"
                            ? "Transcribing & resolving sandbox paths..."
                            : "Recognized Voice Transcript:"}
                      </p>
                      <p className="text-sm font-semibold text-white">
                        "{activeScenario.transcript}"
                      </p>
                    </div>
                  </div>

                  {/* Simulated 60fps Audio Waveform */}
                  <div className="hidden items-center gap-1 sm:flex">
                    {[18, 32, 14, 28, 36, 22, 16, 30, 12].map((h, idx) => (
                      <motion.span
                        key={idx}
                        animate={{
                          height: pillState === "LISTENING" ? [8, h, 10] : 6,
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.55,
                          delay: idx * 0.06,
                        }}
                        className="w-1 rounded-full bg-indigo-400"
                        style={{ height: 8 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic State Body */}
            <AnimatePresence mode="wait">
              {/* STATE 3: YELLOW TIER CONFIRMATION CARD */}
              {pillState === "YELLOW_AUTH" && (
                <motion.div
                  key="yellow-auth"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg bg-amber-500/20 p-2 text-amber-300">
                        {activeScenario.actionType === "APP_INSTALL" ? (
                          <Download className="h-5 w-5" />
                        ) : (
                          <FolderSync className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                            Yellow Tier • Auth Required
                          </span>
                          <span className="text-xs text-zinc-400">
                            Auto-cancels in {authTimer}s
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-base font-bold text-white">
                          {activeScenario.summary}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Package Metadata Card */}
                  {activeScenario.packageInfo && (
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-zinc-950/60 p-3.5 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-zinc-500">App Name</span>
                        <p className="mt-0.5 font-semibold text-white">
                          {activeScenario.packageInfo.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Package ID</span>
                        <p className="mt-0.5 font-mono text-indigo-300">
                          {activeScenario.packageInfo.id}
                        </p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Version</span>
                        <p className="mt-0.5 font-mono text-zinc-200">
                          {activeScenario.packageInfo.version}
                        </p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Source</span>
                        <p className="mt-0.5 text-emerald-400 font-medium">
                          {activeScenario.packageInfo.source}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Expandable File List Drawer (for FILE_MOVE) */}
                  {activeScenario.files && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowFilesDrawer((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200"
                      >
                        {showFilesDrawer ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        <span>
                          View {activeScenario.files.length} matched files (
                          {activeScenario.totalSize})
                        </span>
                      </button>

                      {showFilesDrawer && (
                        <div className="mt-2.5 max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/80 p-3 font-mono text-xs">
                          {activeScenario.files.map((f, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-zinc-300"
                            >
                              <span className="truncate">{f.path}</span>
                              <span className="text-zinc-500">{f.size}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Progressive Disclosure CLI Toggle (UFR-1) */}
                  <div className="mt-3">
                    <button
                      onClick={() => setShowCliDetails((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      {showCliDetails
                        ? "Hide Technical Details"
                        : "Show CLI / Sandbox Details"}
                    </button>
                    {showCliDetails && (
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-black/70 p-2.5 font-mono text-[11px] text-emerald-300">
                        {activeScenario.cliPreview}
                      </pre>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-5 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setPillState("LISTENING")}
                      className="rounded-xl border border-white/15 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800"
                    >
                      Cancel (Esc)
                    </button>
                    <button
                      onClick={handleApprove}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300"
                    >
                      <span>Approve & Run (Enter)</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STATE 4: RED TIER DESTRUCTIVE QUARANTINE CARD */}
              {pillState === "RED_AUTH" && (
                <motion.div
                  key="red-auth"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-4 rounded-2xl border-2 border-rose-500/60 bg-rose-950/25 p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-rose-500/20 p-2 text-rose-400">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-rose-500/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-rose-300">
                          Red Tier • Destructive Action Guard
                        </span>
                        <span className="text-xs text-rose-300/80">
                          Auto-cancels in {authTimer}s
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-base font-bold text-white">
                        {activeScenario.summary}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-300">
                        Files are held in per-volume{" "}
                        <strong>Quarantine Staging for 24h</strong> before
                        flushing to the OS Recycle Bin, guaranteeing 100%
                        deterministic Undo.
                      </p>
                    </div>
                  </div>

                  {/* Matched Files List */}
                  {activeScenario.files && (
                    <div className="mt-4 space-y-1.5 rounded-xl border border-rose-500/20 bg-zinc-950/80 p-3 font-mono text-xs">
                      {activeScenario.files.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-zinc-200"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Trash2 className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                            {f.path}
                          </span>
                          <span className="text-rose-300">{f.size}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PRD-02 / US-05: Large Deletion (> 2 GB) Direct Recycle Bin Bypass */}
                  {activeScenario.isLargeDelete && (
                    <label className="mt-3.5 flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={skipQuarantine}
                        onChange={(e) => setSkipQuarantine(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-600 text-rose-500 focus:ring-rose-500"
                      />
                      <span>
                        Batch exceeds 2 GB:{" "}
                        <strong>Flush directly to OS Recycle Bin</strong> (skip
                        24h quarantine staging)
                      </span>
                    </label>
                  )}

                  {/* Action Buttons (Default Focus on Cancel per URS US-05) */}
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-zinc-400">
                      Default focus locked on <strong>Cancel</strong> for safety
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        ref={cancelBtnRef}
                        onClick={() => setPillState("LISTENING")}
                        className="rounded-xl border-2 border-white/40 bg-zinc-900 px-4 py-2 text-xs font-bold text-white ring-2 ring-indigo-500/50 transition hover:bg-zinc-800"
                      >
                        Cancel (Default Focus)
                      </button>
                      <button
                        onClick={handleApprove}
                        className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500"
                      >
                        Delete {activeScenario.files?.length} Files
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STATE 5: EXECUTION PROGRESS BAR */}
              {pillState === "EXECUTING" && (
                <motion.div
                  key="executing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/90 p-5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-300">
                      Executing headless operation (CREATE_NO_WINDOW)...
                    </span>
                    <span className="font-mono text-zinc-400">{progress}%</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </motion.div>
              )}

              {/* STATE 6: COMPLETION & 1-CLICK UNDO TOAST */}
              {pillState === "COMPLETED" && (
                <motion.div
                  key="completed"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">
                        {undoneToast
                          ? "Rolled Back! Restored original system state via SQLite."
                          : `Completed: ${activeScenario.summary}`}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {undoneToast
                          ? "All files verified via mtime_ms & SHA-256 checksums."
                          : "Logged to local WAL SQLite audit trail."}
                      </p>
                    </div>
                  </div>

                  {!undoneToast ? (
                    <button
                      onClick={handleUndo}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/20 px-3.5 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/30"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Undo (Ctrl+Z)
                    </button>
                  ) : (
                    <button
                      onClick={() => runScenario(activeScenario)}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/20"
                    >
                      Replay
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECURITY ARCHITECTURE BENTO GRID                                  */}
        {/* ================================================================= */}
        <section id="security" className="mt-28">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
              Security-First Engineering
            </span>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Zero Raw Shell Strings. Zero Unchecked Paths.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400">
              Giving an LLM direct access to PowerShell or Bash is a security
              disaster. VoxShell isolates the AI inside a strict JSON contract
              and validates every operation in compiled Rust.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
              <div className="mb-4 inline-flex rounded-xl bg-indigo-500/15 p-3 text-indigo-400">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                1. Enum-Constrained JSON Intents
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                The AI never outputs raw terminal commands. It selects from
                strict base directory enums (
                <code className="text-zinc-200">DOWNLOADS</code>,{" "}
                <code className="text-zinc-200">DOCUMENTS</code>,{" "}
                <code className="text-zinc-200">DESKTOP</code>) and typed
                parameters, neutralizing command injection (
                <code className="text-rose-300">;</code>,{" "}
                <code className="text-rose-300">&amp;&amp;</code>,{" "}
                <code className="text-rose-300">|</code>).
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
              <div className="mb-4 inline-flex rounded-xl bg-emerald-500/15 p-3 text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                2. Discrete Folder-Block Sandbox
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Rust flattens relative movements (
                <code className="text-zinc-200">..</code>) in memory, resolves
                NTFS symlinks via{" "}
                <code className="text-zinc-200">dunce::canonicalize</code>, and
                compares discrete lowercased folder blocks so PowerShell
                profiles, Startup folders, and dotfiles (
                <code className="text-zinc-200">.ssh</code>) are hard-blocked.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
              <div className="mb-4 inline-flex rounded-xl bg-amber-500/15 p-3 text-amber-400">
                <RotateCcw className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                3. Two-Stage Quarantine & Undo
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Because Windows Recycle Bin renames files to opaque{" "}
                <code className="text-zinc-200">$Rxxxxxx</code> IDs, VoxShell
                stages deleted and overwritten files in a per-volume Quarantine
                folder for 24 hours—allowing instant, 100% deterministic
                rollback.
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* PERFORMANCE & TECH STACK FOOTER                                   */}
        {/* ================================================================= */}
        <section
          id="download"
          className="mt-24 rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/50 via-zinc-900 to-zinc-900 p-8 sm:p-12"
        >
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                <Cpu className="h-4 w-4" />
                <span>Lightweight Native Desktop Core</span>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                Ready for Windows 10/11 & Linux
              </h2>
              <p className="mt-2 max-w-xl text-sm text-zinc-400">
                Pre-warmed overlay summons in <strong>&lt; 40 ms</strong>, uses{" "}
                <strong>&lt; 45 MB idle RAM</strong>, and preserves fullscreen
                game focus with{" "}
                <code className="text-zinc-200">WS_EX_NOACTIVATE</code>.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <button className="inline-flex items-center gap-2.5 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-zinc-950 shadow-xl transition hover:bg-zinc-200">
                <Download className="h-4 w-4" />
                Windows Installer (.msi)
              </button>
              <button className="inline-flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">
                <Terminal className="h-4 w-4 text-indigo-400" />
                Linux (AppImage / pacman)
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
