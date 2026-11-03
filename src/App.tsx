import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Sun,
  Moon,
  ArrowDown,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Database,
  ShieldAlert,
  Send,
  Terminal,
} from "lucide-react";

type OverlayState =
  | "LISTENING"
  | "PROCESSING"
  | "YELLOW_AUTH"
  | "RED_AUTH"
  | "EXECUTING"
  | "COMPLETED";

interface CommandScenario {
  id: string;
  num: string;
  title: string;
  transcript: string;
  badge: string;
  tier: "YELLOW" | "RED";
  actionType: "APP_INSTALL" | "FILE_MOVE" | "FILE_DELETE";
  summary: string;
  cliCommand: string;
  packageMeta?: {
    name: string;
    id: string;
    version: string;
    source: string;
  };
  files?: { path: string; size: string }[];
  totalSize?: string;
  isLargeBatch?: boolean;
}

const SCENARIOS: CommandScenario[] = [
  {
    id: "discord",
    num: "01",
    title: "Install Discord",
    transcript: "Hey, can you download Discord for me?",
    badge: "YELLOW TIER • WINGET",
    tier: "YELLOW",
    actionType: "APP_INSTALL",
    summary: "Install Discord (Per-User Silent Scope)",
    cliCommand:
      "winget install --id Discord.Discord --exact --scope user --silent --accept-package-agreements",
    packageMeta: {
      name: "Discord",
      id: "Discord.Discord",
      version: "1.0.9168",
      source: "winget (Official)",
    },
  },
  {
    id: "pdfs",
    num: "02",
    title: "Organize PDFs",
    transcript: "Move all PDFs from Downloads to Invoices in my Documents",
    badge: "YELLOW TIER • BATCH MOVE",
    tier: "YELLOW",
    actionType: "FILE_MOVE",
    summary: "Create 'Documents\\Invoices' & move 4 PDF files (6.8 MB)",
    cliCommand:
      "atomic_move_file(Downloads/*.pdf -> Documents/Invoices/) [collision_policy: AUTO_RENAME]",
    totalSize: "6.8 MB",
    files: [
      { path: "Downloads\\AWS_Invoice_Oct.pdf", size: "1.2 MB" },
      { path: "Downloads\\Tuition_Receipt_2026.pdf", size: "2.4 MB" },
      { path: "Downloads\\Hardware_Quote.pdf", size: "0.9 MB" },
      { path: "Downloads\\Tax_Summary_FY26.pdf", size: "2.3 MB" },
    ],
  },
  {
    id: "zips",
    num: "03",
    title: "Clean Old .zip Archives",
    transcript: "Delete all zip files in my Downloads folder",
    badge: "RED TIER • 24H QUARANTINE",
    tier: "RED",
    actionType: "FILE_DELETE",
    summary: "Stage 3 .zip archives (2.4 GB) into Per-Volume Quarantine",
    cliCommand:
      "quarantine::stage_delete(Downloads/*.zip -> %LOCALAPPDATA%\\VoxShell\\quarantine\\cmd_9f8a\\)",
    totalSize: "2.4 GB",
    isLargeBatch: true,
    files: [
      { path: "Downloads\\old_build_artifacts.zip", size: "1.6 GB" },
      { path: "Downloads\\dataset_backup_v1.zip", size: "620 MB" },
      { path: "Downloads\\temp_icons_pack.zip", size: "180 MB" },
    ],
  },
];

interface WalRow {
  order: number;
  opType: "MKDIR" | "MOVE" | "OVERWRITE_STAGING" | "SOFT_DELETE";
  source: string;
  destination: string;
  mtimeMs: string;
  sha256: string;
  modifiedAfterMove?: boolean;
}

const WAL_AUDIT_ROWS: WalRow[] = [
  {
    order: 1,
    opType: "MKDIR",
    source: "—",
    destination: "Documents\\Invoices",
    mtimeMs: "1730634120110",
    sha256: "DIR_EMPTY_CHECK",
  },
  {
    order: 2,
    opType: "MOVE",
    source: "Downloads\\AWS_Invoice_Oct.pdf",
    destination: "Documents\\Invoices\\AWS_Invoice_Oct.pdf",
    mtimeMs: "1730634120142",
    sha256: "8f434346648f6b96...",
  },
  {
    order: 3,
    opType: "MOVE",
    source: "Downloads\\Notes_Draft.docx",
    destination: "Documents\\Invoices\\Notes_Draft.docx",
    mtimeMs: "1730634120189",
    sha256: "2c26b46b68ffc68f...",
    modifiedAfterMove: true,
  },
];

export default function App() {
  // Light / Dark theme state (defaults to the warm alabaster Vault theme from screenshots)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("voxshell_vault_theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    window.localStorage.setItem(
      "voxshell_vault_theme",
      isDark ? "dark" : "light",
    );
  }, [isDark]);

  // Overlay Simulator States
  const [scenario, setScenario] = useState<CommandScenario>(SCENARIOS[0]);
  const [overlayState, setOverlayState] = useState<OverlayState>("LISTENING");
  const [autoAdvance, setAutoAdvance] = useState<boolean>(false);
  const [isTypingMode, setIsTypingMode] = useState<boolean>(false);
  const [typedCommand, setTypedCommand] = useState<string>("");
  const [expandFiles, setExpandFiles] = useState<boolean>(false);
  const [showRawCli, setShowRawCli] = useState<boolean>(false);
  const [bypassQuarantine, setBypassQuarantine] = useState<boolean>(false);
  const [execProgress, setExecProgress] = useState<number>(0);
  const [authSeconds, setAuthSeconds] = useState<number>(30);
  const [isUndone, setIsUndone] = useState<boolean>(false);

  // SQLite Rollback Interactive States
  const [simulateEditConflict, setSimulateEditConflict] =
    useState<boolean>(false);
  const [undoExecuted, setUndoExecuted] = useState<boolean>(false);

  // Contact Section States
  const [contactData, setContactData] = useState({
    name: "",
    email: "",
    subject: "Early Access & MVP Testing",
    message: "",
  });
  const [contactSent, setContactSent] = useState<boolean>(false);

  const redCancelRef = useRef<HTMLButtonElement>(null);

  // Declarative state progression when user clicks a voice command
  useEffect(() => {
    if (!autoAdvance) return;

    if (overlayState === "LISTENING") {
      const timer = window.setTimeout(() => {
        setOverlayState("PROCESSING");
      }, 1100);
      return () => window.clearTimeout(timer);
    }

    if (overlayState === "PROCESSING") {
      const timer = window.setTimeout(() => {
        setAuthSeconds(30);
        setOverlayState(scenario.tier === "RED" ? "RED_AUTH" : "YELLOW_AUTH");
        setAutoAdvance(false);
      }, 950);
      return () => window.clearTimeout(timer);
    }
  }, [overlayState, autoAdvance, scenario.tier]);

  // Default focus on Cancel button for Red Tier destructive prompts (URS US-05)
  useEffect(() => {
    if (overlayState === "RED_AUTH") {
      redCancelRef.current?.focus();
    }
  }, [overlayState]);

  // 30-second auto-timeout on Yellow/Red confirmation cards (URS UFR-2)
  useEffect(() => {
    if (overlayState !== "YELLOW_AUTH" && overlayState !== "RED_AUTH") return;
    const interval = window.setInterval(() => {
      setAuthSeconds((prev) => {
        if (prev <= 1) {
          setOverlayState("LISTENING");
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [overlayState]);

  // Execution progress bar animation
  useEffect(() => {
    if (overlayState !== "EXECUTING") return;
    setExecProgress(0);
    const interval = window.setInterval(() => {
      setExecProgress((prev) => {
        if (prev >= 100) {
          window.clearInterval(interval);
          setOverlayState("COMPLETED");
          return 100;
        }
        return prev + 25;
      });
    }, 160);
    return () => window.clearInterval(interval);
  }, [overlayState]);

  const handleSelectScenario = (next: CommandScenario) => {
    setScenario(next);
    setExpandFiles(false);
    setShowRawCli(false);
    setBypassQuarantine(false);
    setIsUndone(false);
    setOverlayState("LISTENING");
    setAutoAdvance(true);
  };

  const handleManualTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = typedCommand.trim().slice(0, 150);
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();

    if (
      lower.includes("delete") ||
      lower.includes("zip") ||
      lower.includes("remove")
    ) {
      handleSelectScenario({ ...SCENARIOS[2], transcript: cleaned });
    } else if (
      lower.includes("move") ||
      lower.includes("pdf") ||
      lower.includes("folder")
    ) {
      handleSelectScenario({ ...SCENARIOS[1], transcript: cleaned });
    } else {
      handleSelectScenario({ ...SCENARIOS[0], transcript: cleaned });
    }
    setTypedCommand("");
    setIsTypingMode(false);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !contactData.name.trim() ||
      !contactData.email.trim() ||
      !contactData.message.trim()
    ) {
      return;
    }
    setContactSent(true);
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-[#111613] text-[#ECE8DF]" : "bg-[#EFECE6] text-[#181816]"
      }`}
    >
      {/* =================================================================== */}
      {/* TOP NAVIGATION BAR (Matches Reference Images 1 & 2)                 */}
      {/* =================================================================== */}
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-md transition-colors duration-300 ${
          isDark
            ? "border-white/10 bg-[#111613]/90"
            : "border-[#DEDAD0] bg-[#EFECE6]/90"
        }`}
      >
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-6 py-3.5">
          {/* Left Brand + Monospace Tag */}
          <a href="#" className="flex items-baseline gap-2.5">
            <span className="font-serif-vault text-[22px] tracking-tight">
              VoxShell
            </span>
            <span
              className={`font-mono-vault text-[9px] tracking-[0.16em] uppercase ${
                isDark ? "text-[#8A9E91]" : "text-[#7C7970]"
              }`}
            >
              TAURI V2 • RUST
            </span>
          </a>

          {/* Center Section Links */}
          <nav
            className={`hidden items-center gap-7 text-[11.5px] md:flex ${
              isDark ? "text-[#B5C2B9]" : "text-[#4D4A44]"
            }`}
          >
            <a href="#demo" className="transition hover:opacity-65">
              Live Overlay Demo
            </a>
            <a href="#sandbox" className="transition hover:opacity-65">
              Zero-Trust Sandbox
            </a>
            <a href="#rollback" className="transition hover:opacity-65">
              SQLite Rollback
            </a>
            <a href="#contact" className="transition hover:opacity-65">
              Contact
            </a>
          </nav>

          {/* Right Theme Toggle + Download MVP Pill */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label="Toggle color theme"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                isDark
                  ? "border-white/15 bg-white/5 text-[#ECE8DF] hover:bg-white/10"
                  : "border-[#D4CFC3] bg-[#E6E2D8] text-[#1F3A2E] hover:bg-[#DDD8CC]"
              }`}
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>

            <a
              href="#download"
              className={`rounded-full px-4 py-1.5 text-[11px] font-medium tracking-wide transition ${
                isDark
                  ? "bg-[#2B5440] text-white hover:bg-[#34654D]"
                  : "bg-[#1F3A2E] text-[#F4F1EA] hover:bg-[#162920]"
              }`}
            >
              Download MVP
            </a>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* HERO SECTION (Matches Reference Image 1)                            */}
      {/* =================================================================== */}
      <section className="mx-auto max-w-[920px] px-6 pt-20 pb-24 text-center sm:pt-28 sm:pb-28">
        {/* Hotkey Prompt Line */}
        <div
          className={`mb-5 inline-flex items-center gap-2 text-[11.5px] ${
            isDark ? "text-[#99AA9E]" : "text-[#5E5B54]"
          }`}
        >
          <span>Press</span>
          <kbd
            className={`font-mono-vault rounded border px-2 py-0.5 text-[10.5px] ${
              isDark
                ? "border-white/20 bg-white/5 text-[#ECE8DF]"
                : "border-[#C8C3B7] bg-[#E6E2D8] text-[#181816]"
            }`}
          >
            Alt + Space
          </kbd>
          <span>to command Windows &amp; Linux by voice</span>
        </div>

        {/* Display Editorial Heading */}
        <h1 className="font-serif-vault text-[52px] leading-[1.03] tracking-[-0.02em] sm:text-[72px] md:text-[84px]">
          The Power of the
          <br />
          Terminal.{" "}
          <span
            className={`italic ${isDark ? "text-[#6BB38B]" : "text-[#234B36]"}`}
          >
            The
            <br />
            Speed of Your Voice.
          </span>
        </h1>

        {/* Subheadline Copy */}
        <p
          className={`mx-auto mt-7 max-w-[520px] text-[13.5px] leading-[1.68] ${
            isDark ? "text-[#99AA9E]" : "text-[#5E5B54]"
          }`}
        >
          Install apps via{" "}
          <code
            className={`font-mono-vault rounded px-1.5 py-0.5 text-[11.5px] ${
              isDark
                ? "bg-white/10 text-[#ECE8DF]"
                : "bg-[#E2DDD2] text-[#181816]"
            }`}
          >
            winget
          </code>
          , batch-organize messy folders, and clean up disk space without
          memorizing a single flag. Built in Rust with a discrete folder-block
          sandbox and 1-step transactional Undo.
        </p>
      </section>

      {/* =================================================================== */}
      {/* FULL-WIDTH FOREST GREEN BAND: LIVE OVERLAY DEMO (Image 1)           */}
      {/* =================================================================== */}
      <section
        id="demo"
        className={`w-full py-20 transition-colors duration-300 sm:py-24 ${
          isDark ? "bg-[#162820]" : "bg-[#203B2E]"
        } text-[#F3F0E8]`}
      >
        <div className="mx-auto grid max-w-[1040px] items-start gap-10 px-6 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: 01, 02, 03 Voice Command List */}
          <div className="lg:col-span-5">
            <p className="font-mono-vault text-[9.5px] tracking-[0.2em] uppercase text-[#8AA696]">
              LIVE OVERLAY DEMO
            </p>
            <h2 className="font-serif-vault mt-1.5 text-[32px] leading-tight text-[#F4F1EA]">
              Try a Voice Command:
            </h2>

            <div className="mt-6 divide-y divide-white/12 border-t border-b border-white/12">
              {SCENARIOS.map((item) => {
                const isSelected = scenario.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectScenario(item)}
                    className={`group flex w-full items-start gap-3.5 py-4 text-left transition ${
                      isSelected ? "opacity-100" : "opacity-65 hover:opacity-95"
                    }`}
                  >
                    <span className="font-mono-vault mt-0.5 text-[10px] text-[#789F8A]">
                      {item.num}
                    </span>
                    <div className="flex-1">
                      <p className="text-[11.5px] font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="font-serif-vault mt-0.5 text-[16.5px] italic leading-snug text-[#DCE7E0]">
                        "{item.transcript}"
                      </p>
                      <span
                        className={`font-mono-vault mt-1.5 inline-block text-[9px] tracking-[0.14em] uppercase ${
                          item.tier === "RED"
                            ? "text-[#E58573]"
                            : "text-[#D6B265]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Floating Cream Overlay Card */}
          <div className="lg:col-span-7">
            <div
              className={`flex min-h-[340px] flex-col justify-between rounded-xl border p-6 shadow-2xl transition-colors duration-300 sm:p-7 ${
                isDark
                  ? "border-white/15 bg-[#1D3328] text-[#ECE8DF]"
                  : "border-[#DCD7CC] bg-[#F4F1EA] text-[#181816]"
              }`}
            >
              <div>
                {/* Card Top Status Header */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3.5 ${
                    isDark ? "border-white/10" : "border-[#E2DDD2]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#2B6E4E]" />
                    <span
                      className={`font-mono-vault text-[10.5px] ${
                        isDark ? "text-[#A5B8AD]" : "text-[#78756E]"
                      }`}
                    >
                      voxshell://overlay • State:{" "}
                      <strong
                        className={isDark ? "text-white" : "text-[#181816]"}
                      >
                        {overlayState}
                      </strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsTypingMode((prev) => !prev)}
                    className={`font-mono-vault rounded border px-2.5 py-1 text-[9.5px] transition ${
                      isDark
                        ? "border-white/15 bg-white/5 text-[#D8E2DC] hover:bg-white/10"
                        : "border-[#D5CFC2] bg-[#EAE5DB] text-[#3F3D38] hover:bg-[#E0DAD0]"
                    }`}
                  >
                    {isTypingMode ? "Switch to Voice" : "Press Tab to Type"}
                  </button>
                </div>

                {/* Microphone & Active Voice Transcript Row */}
                <div className="mt-5">
                  {isTypingMode ? (
                    <form
                      onSubmit={handleManualTypedSubmit}
                      className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 ${
                        isDark
                          ? "border-white/15 bg-black/25"
                          : "border-[#D5CFC2] bg-white"
                      }`}
                    >
                      <Terminal className="h-4 w-4 shrink-0 text-[#203B2E] dark:text-[#6BB38B]" />
                      <input
                        type="text"
                        maxLength={150}
                        value={typedCommand}
                        onChange={(e) => setTypedCommand(e.target.value)}
                        placeholder="Type a command (e.g., 'move all pdfs in downloads')..."
                        className="w-full bg-transparent text-xs focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="rounded bg-[#203B2E] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#162920]"
                      >
                        Preview
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <button
                          type="button"
                          onClick={() => handleSelectScenario(scenario)}
                          title="Trigger Voice Capture"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#203B2E] text-white shadow-sm transition hover:scale-105"
                        >
                          <Mic className="h-4 w-4" />
                        </button>
                        <div>
                          <p
                            className={`text-[10.5px] ${
                              isDark ? "text-[#9FB2A7]" : "text-[#858178]"
                            }`}
                          >
                            {overlayState === "LISTENING"
                              ? "Listening... (VAD Auto-Stop active)"
                              : overlayState === "PROCESSING"
                                ? "Transcribing & resolving discrete path blocks..."
                                : "Captured Voice Transcript:"}
                          </p>
                          <p className="font-serif-vault text-[19px] italic leading-snug sm:text-[21px]">
                            "{scenario.transcript}"
                          </p>
                        </div>
                      </div>

                      {/* 7-Bar Audio Waveform (Matches Reference Image 1) */}
                      <div className="hidden items-center gap-[3px] sm:flex">
                        {[7, 14, 22, 12, 24, 15, 9].map((barHeight, i) => (
                          <span
                            key={i}
                            style={{
                              height:
                                overlayState === "LISTENING"
                                  ? `${barHeight}px`
                                  : "8px",
                            }}
                            className={`w-[2.5px] rounded-full transition-all duration-300 ${
                              isDark ? "bg-[#6BB38B]" : "bg-[#203B2E]"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamic State Area */}
                <div className="mt-6">
                  {/* STATE 1 & 2: LISTENING / PROCESSING (Exact minimalist view from Image 1) */}
                  {(overlayState === "LISTENING" ||
                    overlayState === "PROCESSING") && (
                    <div className="py-10">
                      <span
                        className={`font-mono-vault text-xs tracking-widest ${
                          isDark ? "text-[#8AA696]" : "text-[#8C887F]"
                        }`}
                      >
                        ...
                      </span>
                    </div>
                  )}

                  {/* STATE 3: YELLOW TIER CONFIRMATION CARD */}
                  {overlayState === "YELLOW_AUTH" && (
                    <div
                      className={`rounded-lg border p-4 ${
                        isDark
                          ? "border-[#D6B265]/40 bg-black/20"
                          : "border-[#D8C59A] bg-[#EBE5D8]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono-vault text-[9.5px] font-semibold tracking-wider uppercase text-[#8F680A] dark:text-[#E2BF6F]">
                          YELLOW TIER • DRY-RUN PREVIEW
                        </span>
                        <span className="font-mono-vault text-[10px] opacity-65">
                          Auto-cancel in {authSeconds}s
                        </span>
                      </div>

                      <p className="font-serif-vault mt-1.5 text-[21px] leading-snug">
                        {scenario.summary}
                      </p>

                      {scenario.packageMeta && (
                        <div
                          className={`mt-3 grid grid-cols-2 gap-2.5 rounded border p-2.5 text-[11px] sm:grid-cols-4 ${
                            isDark
                              ? "border-white/10 bg-black/25"
                              : "border-[#DAD3C4] bg-[#F7F5F0]"
                          }`}
                        >
                          <div>
                            <span className="text-[9.5px] uppercase opacity-55">
                              App
                            </span>
                            <p className="font-semibold">
                              {scenario.packageMeta.name}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9.5px] uppercase opacity-55">
                              Package ID
                            </span>
                            <p className="font-mono-vault text-[10.5px]">
                              {scenario.packageMeta.id}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9.5px] uppercase opacity-55">
                              Version
                            </span>
                            <p className="font-mono-vault text-[10.5px]">
                              {scenario.packageMeta.version}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9.5px] uppercase opacity-55">
                              Source
                            </span>
                            <p className="font-medium text-[#203B2E] dark:text-[#6BB38B]">
                              {scenario.packageMeta.source}
                            </p>
                          </div>
                        </div>
                      )}

                      {scenario.files && (
                        <div className="mt-2.5">
                          <button
                            type="button"
                            onClick={() => setExpandFiles((v) => !v)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium underline underline-offset-2"
                          >
                            {expandFiles ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            View {scenario.files.length} files (
                            {scenario.totalSize})
                          </button>

                          {expandFiles && (
                            <div
                              className={`font-mono-vault mt-2 max-h-28 space-y-1 overflow-y-auto rounded border p-2 text-[10.5px] ${
                                isDark
                                  ? "border-white/10 bg-black/30"
                                  : "border-[#DAD3C4] bg-white"
                              }`}
                            >
                              {scenario.files.map((f, i) => (
                                <div key={i} className="flex justify-between">
                                  <span className="truncate">{f.path}</span>
                                  <span className="opacity-60">{f.size}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() => setShowRawCli((v) => !v)}
                          className="font-mono-vault text-[9.5px] underline opacity-65 hover:opacity-100"
                        >
                          {showRawCli
                            ? "Hide Parameterized Args"
                            : "Show Parameterized Args"}
                        </button>
                        {showRawCli && (
                          <pre className="font-mono-vault mt-1.5 overflow-x-auto rounded bg-[#181816] p-2 text-[10px] text-[#A8C6B5]">
                            {scenario.cliCommand}
                          </pre>
                        )}
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setOverlayState("LISTENING")}
                          className={`rounded-full border px-3.5 py-1 text-[11px] font-medium ${
                            isDark
                              ? "border-white/20 hover:bg-white/10"
                              : "border-[#C5BFB2] bg-white hover:bg-[#E5E0D5]"
                          }`}
                        >
                          Cancel (Esc)
                        </button>
                        <button
                          type="button"
                          onClick={() => setOverlayState("EXECUTING")}
                          className="rounded-full bg-[#203B2E] px-4 py-1 text-[11px] font-medium text-white hover:bg-[#162920]"
                        >
                          Approve (Enter)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STATE 4: RED TIER QUARANTINE CARD */}
                  {overlayState === "RED_AUTH" && (
                    <div
                      className={`rounded-lg border-2 p-4 ${
                        isDark
                          ? "border-rose-500/50 bg-rose-950/30"
                          : "border-[#C24A32]/60 bg-[#F7E8E5]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono-vault inline-flex items-center gap-1 text-[9.5px] font-bold tracking-wider uppercase text-[#A3321B] dark:text-rose-300">
                          <AlertTriangle className="h-3 w-3" />
                          RED TIER • 24H QUARANTINE STAGING
                        </span>
                        <span className="font-mono-vault text-[10px] opacity-70">
                          {authSeconds}s
                        </span>
                      </div>

                      <p className="font-serif-vault mt-1.5 text-[21px] leading-snug">
                        {scenario.summary}
                      </p>

                      {scenario.files && (
                        <div
                          className={`font-mono-vault mt-2.5 space-y-1 rounded border p-2 text-[10.5px] ${
                            isDark
                              ? "border-white/10 bg-black/30"
                              : "border-[#E2C5BF] bg-white"
                          }`}
                        >
                          {scenario.files.map((f, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="truncate">{f.path}</span>
                              <span className="font-semibold text-[#A3321B] dark:text-rose-300">
                                {f.size}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {scenario.isLargeBatch && (
                        <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[11px]">
                          <input
                            type="checkbox"
                            checked={bypassQuarantine}
                            onChange={(e) =>
                              setBypassQuarantine(e.target.checked)
                            }
                            className="h-3.5 w-3.5 accent-[#203B2E]"
                          />
                          <span>
                            Exceeds 2 GB: Flush directly to OS Recycle Bin (skip
                            24h quarantine)
                          </span>
                        </label>
                      )}

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] opacity-75">
                          Default focus locked on <strong>Cancel</strong>
                        </span>
                        <div className="flex gap-2">
                          <button
                            ref={redCancelRef}
                            type="button"
                            onClick={() => setOverlayState("LISTENING")}
                            className={`rounded-full border-2 px-3.5 py-1 text-[11px] font-semibold ${
                              isDark
                                ? "border-white bg-zinc-900 text-white"
                                : "border-[#181816] bg-white text-[#181816]"
                            }`}
                          >
                            Cancel (Default)
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverlayState("EXECUTING")}
                            className="rounded-full bg-[#A3321B] px-3.5 py-1 text-[11px] font-medium text-white hover:bg-[#872714]"
                          >
                            Delete {scenario.files?.length} Files
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STATE 5: EXECUTING */}
                  {overlayState === "EXECUTING" && (
                    <div className="py-6">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-mono-vault">
                          Executing headless subprocess (CREATE_NO_WINDOW)...
                        </span>
                        <span className="font-mono-vault">{execProgress}%</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/15 dark:bg-white/10">
                        <div
                          className="h-full bg-[#203B2E] transition-all duration-150 dark:bg-[#6BB38B]"
                          style={{ width: `${execProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* STATE 6: COMPLETED + 1-STEP UNDO TOAST */}
                  {overlayState === "COMPLETED" && (
                    <div
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 ${
                        isDark
                          ? "border-[#6BB38B]/40 bg-[#203B2E]/50"
                          : "border-[#A7C4B3] bg-[#E3EDE7]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#203B2E] dark:text-[#6BB38B]" />
                        <div>
                          <p className="text-xs font-semibold">
                            {isUndone
                              ? "Undone! Restored original files via SQLite WAL."
                              : `Completed: ${scenario.summary}`}
                          </p>
                          <p className="text-[10.5px] opacity-75">
                            {isUndone
                              ? "Verified pre_op_mtime_ms & SHA-256 integrity."
                              : "Audit logged to command_logs & file_operations."}
                          </p>
                        </div>
                      </div>

                      {!isUndone ? (
                        <button
                          type="button"
                          onClick={() => setIsUndone(true)}
                          className="inline-flex items-center gap-1 rounded-full bg-[#203B2E] px-3.5 py-1 text-[11px] font-medium text-white hover:bg-[#162920]"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Undo (Ctrl+Z)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOverlayState("LISTENING")}
                          className="font-mono-vault text-[10.5px] underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive State Switcher Footer inside Card */}
              <div
                className={`mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[10px] ${
                  isDark
                    ? "border-white/10 text-[#8AA696]"
                    : "border-[#E2DDD2] text-[#858178]"
                }`}
              >
                <span className="font-mono-vault">INSPECT OVERLAY STATE:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["LISTENING", "1. Listening"],
                      [
                        scenario.tier === "RED" ? "RED_AUTH" : "YELLOW_AUTH",
                        "2. Dry-Run Card",
                      ],
                      ["EXECUTING", "3. Executing"],
                      ["COMPLETED", "4. Undo Toast"],
                    ] as const
                  ).map(([st, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setAutoAdvance(false);
                        setIsUndone(false);
                        setOverlayState(st);
                      }}
                      className={`font-mono-vault rounded px-2 py-0.5 transition ${
                        overlayState === st
                          ? "bg-[#203B2E] text-white dark:bg-[#6BB38B] dark:text-[#111613]"
                          : "hover:underline"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* ZERO-TRUST SANDBOX SECTION (Matches Reference Image 2: i., ii., iii.)*/}
      {/* =================================================================== */}
      <section
        id="sandbox"
        className="mx-auto max-w-[1040px] px-6 pt-24 pb-20 sm:pt-28"
      >
        <div className="mx-auto max-w-[600px] text-center">
          <p
            className={`font-mono-vault text-[9.5px] tracking-[0.22em] uppercase ${
              isDark ? "text-[#8A9E91]" : "text-[#78756E]"
            }`}
          >
            SECURITY-FIRST ENGINEERING
          </p>
          <h2 className="font-serif-vault mt-2.5 text-[42px] leading-[1.06] tracking-[-0.01em] sm:text-[56px]">
            Zero Raw Shell Strings.
            <br />
            Zero Unchecked Paths.
          </h2>
          <p
            className={`mx-auto mt-4 max-w-[460px] text-[13px] leading-[1.65] ${
              isDark ? "text-[#99AA9E]" : "text-[#5E5B54]"
            }`}
          >
            Giving an LLM direct access to PowerShell or Bash is a security
            disaster. VoxShell isolates the AI inside a strict JSON contract and
            validates every operation in compiled Rust.
          </p>
        </div>

        {/* Roman Numeral 3-Column Layout */}
        <div className="mt-16 grid gap-10 md:grid-cols-3">
          {/* Column i */}
          <div
            className={`border-t pt-5 ${
              isDark ? "border-white/20" : "border-[#3A3834]/55"
            }`}
          >
            <span
              className={`font-serif-vault text-[34px] italic leading-none ${
                isDark ? "text-[#6BB38B]" : "text-[#234B36]"
              }`}
            >
              i.
            </span>
            <h3 className="font-serif-vault mt-3 text-[21px] leading-snug">
              Enum-Constrained JSON
              <br />
              Intents
            </h3>
            <p
              className={`mt-2.5 text-[12px] leading-[1.68] ${
                isDark ? "text-[#99AA9E]" : "text-[#5E5B54]"
              }`}
            >
              The AI never outputs raw terminal commands. It selects from strict
              base directory enums (
              <code
                className={`font-mono-vault rounded px-1 py-0.5 text-[10px] ${
                  isDark ? "bg-white/10" : "bg-[#E2DDD2]"
                }`}
              >
                DOWNLOADS
              </code>
              ,{" "}
              <code
                className={`font-mono-vault rounded px-1 py-0.5 text-[10px] ${
                  isDark ? "bg-white/10" : "bg-[#E2DDD2]"
                }`}
              >
                DOCUMENTS
              </code>
              ,{" "}
              <code
                className={`font-mono-vault rounded px-1 py-0.5 text-[10px] ${
                  isDark ? "bg-white/10" : "bg-[#E2DDD2]"
                }`}
              >
                DESKTOP
              </code>
              ) and typed parameters, neutralizing command injection (
              <code className="font-mono-vault text-[10.5px] text-[#A3321B] dark:text-rose-300">
                ;
              </code>
              ,{" "}
              <code className="font-mono-vault text-[10.5px] text-[#A3321B] dark:text-rose-300">
                &amp;&amp;
              </code>
              ,{" "}
              <code className="font-mono-vault text-[10.5px] text-[#A3321B] dark:text-rose-300">
                |
              </code>
              ).
            </p>
          </div>

          {/* Column ii */}
          <div
            className={`border-t pt-5 ${
              isDark ? "border-white/20" : "border-[#3A3834]/55"
            }`}
          >
            <span
              className={`font-serif-vault text-[34px] italic leading-none ${
                isDark ? "text-[#6BB38B]" : "text-[#234B36]"
              }`}
            >
              ii.
            </span>
            <h3 className="font-serif-vault mt-3 text-[21px] leading-snug">
              Discrete Folder-Block Sandbox
            </h3>
            <p
              className={`mt-2.5 text-[12px] leading-[1.68] ${
                isDark ? "text-[#99AA9E]" : "text-[#5E5B54]"
              }`}
            >
              Rust flattens relative movements (
              <code
                className={`font-mono-vault rounded px-1 py-0.5 text-[10px] ${
                  isDark ? "bg-white/10" : "bg-[#E2DDD2]"
                }`}
              >
                ..
              </code>
              ) in memory, resolves NTFS symlinks via{" "}
              <code
                className={`font-mono-vault rounded px-1 py-0.5 text-[10px] ${
                  isDark ? "bg-white/10" : "bg-[#E2DDD2]"
                }`}
              >
                dunce::canonicalize
              </code>
              , and compares discrete lowercased folder blocks so PowerShell
              profiles, Startup folders, and dotfiles (
              <code
                className={`font-mono-vault rounded px-1 py-0.5 text-[10px] ${
                  isDark ? "bg-white/10" : "bg-[#E2DDD2]"
                }`}
              >
                .ssh
              </code>
              ) are hard-blocked.
            </p>
          </div>

          {/* Column iii */}
          <div
            className={`border-t pt-5 ${
              isDark ? "border-white/20" : "border-[#3A3834]/55"
            }`}
          >
            <span
              className={`font-serif-vault text-[34px] italic leading-none ${
                isDark ? "text-[#6BB38B]" : "text-[#234B36]"
              }`}
            >
              iii.
            </span>
            <h3 className="font-serif-vault mt-3 text-[21px] leading-snug">
              Two-Stage Quarantine &amp; Undo
            </h3>
            <p
              className={`mt-2.5 text-[12px] leading-[1.68] ${
                isDark ? "text-[#99AA9E]" : "text-[#5E5B54]"
              }`}
            >
              Because Windows Recycle Bin renames files to opaque{" "}
              <code
                className={`font-mono-vault rounded px-1 py-0.5 text-[10px] ${
                  isDark ? "bg-white/10" : "bg-[#E2DDD2]"
                }`}
              >
                $Rxxxxxx
              </code>{" "}
              IDs, VoxShell stages deleted and overwritten files in a per-volume
              Quarantine folder for 24 hours—allowing instant, 100%
              deterministic rollback.
            </p>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* SQLITE ROLLBACK SECTION (#rollback linked from Navbar)              */}
      {/* =================================================================== */}
      <section id="rollback" className="mx-auto max-w-[1040px] px-6 py-16">
        <div
          className={`rounded-2xl border p-8 sm:p-10 ${
            isDark
              ? "border-white/15 bg-[#17211C]"
              : "border-[#D8D3C7] bg-[#E5E1D8]"
          }`}
        >
          <div className="grid items-start gap-10 lg:grid-cols-12">
            {/* Left Explanation + Interactive Conflict Trigger */}
            <div className="lg:col-span-5">
              <p
                className={`font-mono-vault text-[9.5px] tracking-[0.2em] uppercase ${
                  isDark ? "text-[#8A9E91]" : "text-[#78756E]"
                }`}
              >
                WAL-MODE AUDIT &amp; RECOVERY
              </p>
              <h2 className="font-serif-vault mt-2 text-[36px] leading-[1.08] sm:text-[42px]">
                Transactional SQLite
                <br />
                Rollback Engine.
              </h2>
              <p
                className={`mt-3.5 text-[12.5px] leading-[1.68] ${
                  isDark ? "text-[#A5B8AD]" : "text-[#54514B]"
                }`}
              >
                Every voice request in{" "}
                <code className="font-mono-vault text-[11px]">
                  command_logs
                </code>{" "}
                records atomic file operations in{" "}
                <code className="font-mono-vault text-[11px]">
                  file_operations
                </code>
                . Hitting <strong>Undo</strong> reverses each operation in
                descending order after verifying{" "}
                <code className="font-mono-vault text-[11px]">
                  post_op_mtime_ms
                </code>{" "}
                and SHA-256 hashes so post-move user edits are never lost.
              </p>

              <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[11.5px]">
                <input
                  type="checkbox"
                  checked={simulateEditConflict}
                  onChange={(e) => {
                    setSimulateEditConflict(e.target.checked);
                    setUndoExecuted(false);
                  }}
                  className="mt-0.5 h-3.5 w-3.5 accent-[#1F3A2E]"
                />
                <span>
                  Simulate user editing{" "}
                  <code className="font-mono-vault text-[10.5px]">
                    Notes_Draft.docx
                  </code>{" "}
                  before Undo (triggers{" "}
                  <code className="font-mono-vault text-[10.5px]">
                    ERR_UNDO_MODIFIED
                  </code>{" "}
                  guard)
                </span>
              </label>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setUndoExecuted(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1F3A2E] px-5 py-2 text-[11.5px] font-medium text-[#F4F1EA] transition hover:bg-[#162920]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Run Reverse-Order Rollback
                </button>
                {undoExecuted && (
                  <button
                    type="button"
                    onClick={() => setUndoExecuted(false)}
                    className="font-mono-vault text-[10.5px] underline opacity-75"
                  >
                    Reset Log
                  </button>
                )}
              </div>
            </div>

            {/* Right SQLite Table View */}
            <div className="lg:col-span-7">
              <div
                className={`overflow-hidden rounded-xl border ${
                  isDark
                    ? "border-white/15 bg-[#111613]"
                    : "border-[#CFC9BC] bg-[#F4F1EA]"
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b px-4 py-3 ${
                    isDark ? "border-white/10" : "border-[#E2DDD2]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-[#203B2E] dark:text-[#6BB38B]" />
                    <span className="font-mono-vault text-[10.5px] font-medium">
                      sqlite3 • file_operations (ORDER BY execution_order DESC)
                    </span>
                  </div>
                  <span className="font-mono-vault text-[9.5px] uppercase opacity-60">
                    WAL MODE
                  </span>
                </div>

                <div className="divide-y divide-black/10 p-4 dark:divide-white/10">
                  {[...WAL_AUDIT_ROWS].reverse().map((row) => {
                    const skippedConflict =
                      undoExecuted &&
                      simulateEditConflict &&
                      row.modifiedAfterMove;
                    const restored = undoExecuted && !skippedConflict;

                    return (
                      <div
                        key={row.order}
                        className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-vault rounded bg-[#203B2E]/12 px-1.5 py-0.5 text-[9.5px] font-semibold text-[#203B2E] dark:bg-white/10 dark:text-[#6BB38B]">
                              #{row.order} {row.opType}
                            </span>
                            <span className="font-mono-vault text-[11px] font-medium">
                              {row.destination}
                            </span>
                          </div>
                          <p className="font-mono-vault mt-0.5 text-[10px] opacity-60">
                            mtime_ms: {row.mtimeMs} • sha256: {row.sha256}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {!undoExecuted && (
                            <span className="font-mono-vault rounded-full border border-current/20 px-2.5 py-0.5 text-[9.5px] opacity-70">
                              STATUS: SUCCESS
                            </span>
                          )}
                          {restored && (
                            <span className="font-mono-vault inline-flex items-center gap-1 rounded-full bg-[#1F3A2E] px-2.5 py-0.5 text-[9.5px] text-white">
                              <CheckCircle2 className="h-3 w-3" />
                              UNDONE
                            </span>
                          )}
                          {skippedConflict && (
                            <span className="font-mono-vault inline-flex items-center gap-1 rounded-full bg-[#A3321B] px-2.5 py-0.5 text-[9.5px] text-white">
                              <ShieldAlert className="h-3 w-3" />
                              ERR_UNDO_MODIFIED
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* DOWNLOAD CARD SECTION (Matches Reference Image 2)                   */}
      {/* =================================================================== */}
      <section id="download" className="mx-auto max-w-[1040px] px-6 pt-8 pb-16">
        <div
          className={`rounded-2xl border px-8 py-10 sm:px-12 sm:py-12 ${
            isDark
              ? "border-white/15 bg-[#17211C]"
              : "border-[#D8D3C7] bg-[#E5E1D8]"
          }`}
        >
          <div className="grid items-center gap-8 md:grid-cols-12">
            {/* Left Copy */}
            <div className="md:col-span-7">
              <p
                className={`font-mono-vault text-[9.5px] tracking-[0.2em] uppercase ${
                  isDark ? "text-[#8A9E91]" : "text-[#78756E]"
                }`}
              >
                LIGHTWEIGHT NATIVE DESKTOP CORE
              </p>
              <h2 className="font-serif-vault mt-2 text-[40px] leading-[1.04] sm:text-[48px]">
                Ready for Windows
                <br />
                10/11 &amp; Linux
              </h2>
              <p
                className={`mt-3.5 max-w-[420px] text-[12px] leading-[1.65] ${
                  isDark ? "text-[#A5B8AD]" : "text-[#54514B]"
                }`}
              >
                Pre-warmed overlay summons in <strong>&lt; 40 ms</strong>, uses{" "}
                <strong>&lt; 45 MB idle RAM</strong>, and preserves fullscreen
                game focus with{" "}
                <code
                  className={`font-mono-vault rounded px-1.5 py-0.5 text-[10.5px] ${
                    isDark ? "bg-white/10" : "bg-[#D8D3C7]"
                  }`}
                >
                  WS_EX_NOACTIVATE
                </code>
                .
              </p>
            </div>

            {/* Right Pill Buttons (Exact Match to Image 2) */}
            <div className="flex flex-col gap-3 md:col-span-5">
              <a
                href="#contact"
                className="flex items-center justify-between rounded-full bg-[#1F3A2E] px-6 py-3.5 text-[11.5px] font-medium text-[#F4F1EA] transition hover:bg-[#162920]"
              >
                <span>Windows Installer (.msi)</span>
                <ArrowDown className="h-3.5 w-3.5" />
              </a>
              <a
                href="#contact"
                className={`flex items-center justify-between rounded-full border px-6 py-3.5 text-[11.5px] font-medium transition ${
                  isDark
                    ? "border-white/25 text-[#ECE8DF] hover:bg-white/5"
                    : "border-[#ABA69B] text-[#181816] hover:bg-[#DDD8CC]"
                }`}
              >
                <span>Linux (AppImage / pacman)</span>
                <ArrowDown className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* CONTACT SECTION (#contact matching Vault Editorial Aesthetic)       */}
      {/* =================================================================== */}
      <section id="contact" className="mx-auto max-w-[1040px] px-6 pt-8 pb-24">
        <div
          className={`border-t pt-16 ${
            isDark ? "border-white/15" : "border-[#D5CFC2]"
          }`}
        >
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <p
                className={`font-mono-vault text-[9.5px] tracking-[0.2em] uppercase ${
                  isDark ? "text-[#8A9E91]" : "text-[#78756E]"
                }`}
              >
                EARLY ACCESS &amp; FEEDBACK
              </p>
              <h2 className="font-serif-vault mt-2 text-[38px] leading-[1.06] sm:text-[44px]">
                Get in Touch.
              </h2>
              <p
                className={`mt-3 text-[12.5px] leading-[1.68] ${
                  isDark ? "text-[#99AA9E]" : "text-[#5E5B54]"
                }`}
              >
                Interested in testing the Tauri v2 desktop builds on Windows 11
                or Linux, or have a question about the path sandbox and
                quarantine architecture? Drop a note below.
              </p>

              <div className="mt-8 space-y-4 text-xs">
                <div>
                  <span className="font-mono-vault text-[9.5px] uppercase opacity-60">
                    STACK &amp; LICENSE
                  </span>
                  <p className="mt-0.5 font-medium">
                    Tauri v2 • Rust • Vite + React • SQLite WAL
                  </p>
                </div>
                <div>
                  <span className="font-mono-vault text-[9.5px] uppercase opacity-60">
                    DIRECT CHANNEL
                  </span>
                  <p className="mt-0.5 font-medium">hello@voxshell.dev</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-7">
              {contactSent ? (
                <div
                  className={`rounded-2xl border p-8 ${
                    isDark
                      ? "border-[#6BB38B]/40 bg-[#17211C]"
                      : "border-[#A7C4B3] bg-[#E3EDE7]"
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5 text-[#1F3A2E] dark:text-[#6BB38B]" />
                  <h3 className="font-serif-vault mt-2.5 text-2xl">
                    Message Logged.
                  </h3>
                  <p className="mt-1 text-xs opacity-80">
                    Thanks, {contactData.name}. Your inquiry under{" "}
                    <strong>{contactData.subject}</strong> has been received.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setContactSent(false);
                      setContactData({
                        name: "",
                        email: "",
                        subject: "Early Access & MVP Testing",
                        message: "",
                      });
                    }}
                    className="font-mono-vault mt-4 text-[11px] underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleContactSubmit}
                  className={`space-y-4 rounded-2xl border p-6 sm:p-8 ${
                    isDark
                      ? "border-white/15 bg-[#17211C]"
                      : "border-[#D8D3C7] bg-[#E5E1D8]"
                  }`}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="font-mono-vault block text-[9.5px] tracking-wider uppercase opacity-70">
                        Name
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={80}
                        value={contactData.name}
                        onChange={(e) =>
                          setContactData({
                            ...contactData,
                            name: e.target.value,
                          })
                        }
                        placeholder="Your name"
                        className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${
                          isDark
                            ? "border-white/15 bg-[#111613] text-white"
                            : "border-[#CFC9BC] bg-[#F4F1EA] text-[#181816]"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="font-mono-vault block text-[9.5px] tracking-wider uppercase opacity-70">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        maxLength={120}
                        value={contactData.email}
                        onChange={(e) =>
                          setContactData({
                            ...contactData,
                            email: e.target.value,
                          })
                        }
                        placeholder="you@example.com"
                        className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${
                          isDark
                            ? "border-white/15 bg-[#111613] text-white"
                            : "border-[#CFC9BC] bg-[#F4F1EA] text-[#181816]"
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-mono-vault block text-[9.5px] tracking-wider uppercase opacity-70">
                      Topic
                    </label>
                    <select
                      value={contactData.subject}
                      onChange={(e) =>
                        setContactData({
                          ...contactData,
                          subject: e.target.value,
                        })
                      }
                      className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${
                        isDark
                          ? "border-white/15 bg-[#111613] text-white"
                          : "border-[#CFC9BC] bg-[#F4F1EA] text-[#181816]"
                      }`}
                    >
                      <option>Early Access &amp; MVP Testing</option>
                      <option>Zero-Trust Sandbox / Security Feedback</option>
                      <option>Linux (pacman / apt) Support</option>
                      <option>General Question</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-mono-vault block text-[9.5px] tracking-wider uppercase opacity-70">
                      Message
                    </label>
                    <textarea
                      rows={3}
                      required
                      maxLength={800}
                      value={contactData.message}
                      onChange={(e) =>
                        setContactData({
                          ...contactData,
                          message: e.target.value,
                        })
                      }
                      placeholder="Which OS are you using, and what terminal tasks do you want to automate by voice?"
                      className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${
                        isDark
                          ? "border-white/15 bg-[#111613] text-white"
                          : "border-[#CFC9BC] bg-[#F4F1EA] text-[#181816]"
                      }`}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full bg-[#1F3A2E] px-6 py-2.5 text-[11.5px] font-medium text-[#F4F1EA] transition hover:bg-[#162920]"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send Message
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Footer */}
      <footer
        className={`border-t py-7 text-xs ${
          isDark
            ? "border-white/10 text-[#7A8E82]"
            : "border-[#DEDAD0] text-[#78756E]"
        }`}
      >
        <div className="mx-auto flex max-w-[1040px] flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <span className="font-serif-vault text-lg text-current">
            VoxShell
          </span>
          <span className="font-mono-vault text-[10.5px]">
            Tauri v2 • Rust Core • SQLite WAL Rollback
          </span>
        </div>
      </footer>
    </div>
  );
}
