import { useState } from "react";
import {
  Bell,
  Plus,
  X,
  Check,
  Volume2,
  VolumeX,
  ArrowRight,
  Mic,
  Compass,
} from "lucide-react";
import type { DreamEntry, RealityCheckConfig } from "../types/dream";
import { createEmptyLucidData } from "./LucidDetailsEditor";

interface LucidityViewProps {
  dreams: DreamEntry[];
  config: RealityCheckConfig;
  nextReminderLabel: string | null;
  notificationPermission: NotificationPermission | "unsupported";
  onUpdateConfig: (next: RealityCheckConfig) => void;
  onRequestBrowserNotifications: () => Promise<void>;
  onTestReminder: () => void;
  onLogManualCheck: () => void;
  onOpenDream: (id: string) => void;
  onMarkDreamLucid: (dreamId: string) => void;
  onOpenLucidCapture: () => void;
}

const INTERVAL_OPTIONS = [
  { label: "30 min", minutes: 30 },
  { label: "60 min", minutes: 60 },
  { label: "90 min", minutes: 90 },
  { label: "2 hours", minutes: 120 },
  { label: "3 hours", minutes: 180 },
];

const PROMPT_PRESETS = [
  "Look down at your hands and count each finger carefully. Pause and ask: am I dreaming right now?",
  "Read a line of text nearby, look away for two seconds, and read it again—did the letters change?",
  "Pinch your nose gently and test whether you can still breathe through it while observing your surroundings.",
  "Retrace how you arrived in this exact room. Does the sequence of the last ten minutes make sense?",
];

export function LucidityView({
  dreams,
  config,
  nextReminderLabel,
  notificationPermission,
  onUpdateConfig,
  onRequestBrowserNotifications,
  onTestReminder,
  onLogManualCheck,
  onOpenDream,
  onMarkDreamLucid,
  onOpenLucidCapture,
}: LucidityViewProps) {
  const [newTimeInput, setNewTimeInput] = useState("15:00");
  const [selectedDreamToPromote, setSelectedDreamToPromote] = useState("");

  const lucidDreams = dreams.filter((d) => d.lucidity?.isLucid);
  const nonLucidDreams = dreams.filter((d) => !d.lucidity?.isLucid);

  const totalIntentions = lucidDreams.reduce(
    (sum, d) => sum + (d.lucidity?.intentions.length ?? 0),
    0
  );
  const achievedIntentions = lucidDreams.reduce(
    (sum, d) =>
      sum + (d.lucidity?.intentions.filter((i) => i.achieved).length ?? 0),
    0
  );

  const addCustomTime = () => {
    if (!/^\d{2}:\d{2}$/.test(newTimeInput)) return;
    if (config.customTimes.includes(newTimeInput)) return;
    const sorted = [...config.customTimes, newTimeInput].sort();
    onUpdateConfig({ ...config, customTimes: sorted });
  };

  const removeCustomTime = (time: string) => {
    onUpdateConfig({
      ...config,
      customTimes: config.customTimes.filter((t) => t !== time),
    });
  };

  const handlePromoteDream = () => {
    if (!selectedDreamToPromote) return;
    onMarkDreamLucid(selectedDreamToPromote);
    setSelectedDreamToPromote("");
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-12">
      {/* Header */}
      <header className="flex flex-col gap-6 border-b border-[#202430] pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-medium text-[#8A90A2]">
            Lucid Dreaming Practice
          </p>
          <h1 className="font-editorial text-4xl font-medium text-[#F2F0EB] sm:text-5xl">
            Lucidity & Reality Checks
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[#959BAC]">
            Build waking awareness with customizable daytime reality check reminders, and maintain a dedicated log of lucid dreams, triggers, and conscious dream intentions.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 font-mono text-xs tabular-nums text-[#8A90A2]">
            <span>{lucidDreams.length} lucid entries</span>
            <span aria-hidden="true">·</span>
            <span>
              {achievedIntentions}/{totalIntentions} intentions achieved
            </span>
            <span aria-hidden="true">·</span>
            <span>{config.completedTodayCount} reality checks logged today</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLucidCapture}
          className="inline-flex min-h-[42px] items-center gap-2 self-start rounded-lg bg-[#D4A359] px-4 py-2 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#DFB26E] whitespace-nowrap lg:self-end"
        >
          <Mic className="h-4 w-4" aria-hidden="true" />
          <span>Record New Dream</span>
        </button>
      </header>

      {/* Main 2-Column Layout: Left = Reality Check Reminders Studio, Right = Lucid Dream Log */}
      <div className="grid gap-10 lg:grid-cols-[440px_1fr] lg:items-start">
        {/* Left Column: Customizable Reality Check Reminders */}
        <section
          aria-labelledby="reality-check-heading"
          className="rounded-xl border border-[#222634] bg-[#11141B] p-6 space-y-6"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#1E222E] pb-5">
            <div>
              <h2
                id="reality-check-heading"
                className="font-editorial text-2xl font-medium text-[#F2F0EB]"
              >
                Reality Check Reminders
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#8E94A6]">
                Schedule daytime awareness cues to question whether you are dreaming.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={config.enabled}
              onClick={() => onUpdateConfig({ ...config, enabled: !config.enabled })}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                config.enabled
                  ? "border-[#D4A359] bg-[#D4A359]/15 text-[#F2E0C1]"
                  : "border-[#2B3040] bg-[#161923] text-[#8E94A6] hover:text-[#F2F0EB]"
              }`}
            >
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{config.enabled ? "Active" : "Paused"}</span>
            </button>
          </div>

          {/* Live Status & Manual Habit Log */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1E222E] bg-[#0D0F15] px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] text-[#7E8496]">Next scheduled cue</p>
              <p className="font-mono text-sm tabular-nums text-[#F2F0EB]">
                {config.enabled
                  ? nextReminderLabel ?? "Outside active hours"
                  : "Reminders paused"}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogManualCheck}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-[#2D3343] bg-[#151822] px-3 py-1.5 text-xs font-medium text-[#E8E5DE] transition-colors hover:border-[#D4A359]/70 hover:text-[#E6C080] whitespace-nowrap"
            >
              <Check className="h-3.5 w-3.5 text-[#D4A359]" aria-hidden="true" />
              <span>Log Check ({config.completedTodayCount})</span>
            </button>
          </div>

          {/* Schedule Mode Selector */}
          <div className="space-y-3">
            <span className="block text-xs font-medium text-[#959BAC]">
              Reminder Schedule
            </span>
            <div
              role="tablist"
              aria-label="Reminder schedule type"
              className="grid grid-cols-2 rounded-lg border border-[#242936] bg-[#0D0F15] p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={config.scheduleMode === "interval"}
                onClick={() =>
                  onUpdateConfig({ ...config, scheduleMode: "interval" })
                }
                className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                  config.scheduleMode === "interval"
                    ? "bg-[#232837] text-[#F2F0EB]"
                    : "text-[#8A90A2] hover:text-[#DFDCD4]"
                }`}
              >
                Repeating Interval
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={config.scheduleMode === "times"}
                onClick={() =>
                  onUpdateConfig({ ...config, scheduleMode: "times" })
                }
                className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                  config.scheduleMode === "times"
                    ? "bg-[#232837] text-[#F2F0EB]"
                    : "text-[#8A90A2] hover:text-[#DFDCD4]"
                }`}
              >
                Specific Times
              </button>
            </div>

            {config.scheduleMode === "interval" ? (
              <div className="space-y-4 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {INTERVAL_OPTIONS.map((opt) => {
                    const active = config.intervalMinutes === opt.minutes;
                    return (
                      <button
                        key={opt.minutes}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({
                            ...config,
                            intervalMinutes: opt.minutes,
                          })
                        }
                        className={`rounded-md border px-2.5 py-1.5 font-mono text-xs tabular-nums transition-colors ${
                          active
                            ? "border-[#D4A359] bg-[#D4A359]/15 text-[#F2E0C1]"
                            : "border-[#242936] bg-[#151822] text-[#9EA4B4] hover:border-[#363D52]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="rc-start-time"
                      className="block text-[11px] text-[#83899B]"
                    >
                      Active from
                    </label>
                    <input
                      id="rc-start-time"
                      type="time"
                      value={config.startTime}
                      onChange={(e) =>
                        onUpdateConfig({ ...config, startTime: e.target.value })
                      }
                      className="w-full rounded-lg border border-[#242936] bg-[#151822] px-3 py-2 font-mono text-xs text-[#F2F0EB] focus:border-[#D4A359]/70 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="rc-end-time"
                      className="block text-[11px] text-[#83899B]"
                    >
                      Active until
                    </label>
                    <input
                      id="rc-end-time"
                      type="time"
                      value={config.endTime}
                      onChange={(e) =>
                        onUpdateConfig({ ...config, endTime: e.target.value })
                      }
                      className="w-full rounded-lg border border-[#242936] bg-[#151822] px-3 py-2 font-mono text-xs text-[#F2F0EB] focus:border-[#D4A359]/70 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap gap-2">
                  {config.customTimes.map((time) => (
                    <span
                      key={time}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#282D3B] bg-[#151822] pl-2.5 pr-1 py-1 font-mono text-xs tabular-nums text-[#E4E1D9]"
                    >
                      <span>{time}</span>
                      <button
                        type="button"
                        onClick={() => removeCustomTime(time)}
                        aria-label={`Remove ${time} reminder`}
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-[#7C8292] hover:bg-[#232837] hover:text-[#F2F0EB]"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={newTimeInput}
                    onChange={(e) => setNewTimeInput(e.target.value)}
                    aria-label="Add custom reminder time"
                    className="flex-1 rounded-lg border border-[#242936] bg-[#151822] px-3 py-2 font-mono text-xs text-[#F2F0EB] focus:border-[#D4A359]/70 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addCustomTime}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#303647] bg-[#171B26] px-3 py-1.5 text-xs font-medium text-[#E8E5DE] hover:border-[#D4A359]/70 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Add time</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Customizable Reality Check Prompt */}
          <div className="space-y-2.5 border-t border-[#1E222E] pt-5">
            <label
              htmlFor="rc-prompt-input"
              className="block text-xs font-medium text-[#959BAC]"
            >
              Reality Check Cue Prompt
            </label>
            <textarea
              id="rc-prompt-input"
              rows={3}
              value={config.promptText}
              onChange={(e) =>
                onUpdateConfig({ ...config, promptText: e.target.value })
              }
              className="w-full rounded-lg border border-[#242936] bg-[#151822] p-3 text-xs leading-relaxed text-[#F2F0EB] focus:border-[#D4A359]/70 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {["Hands Check", "Text Re-Read", "Breath Test", "Memory Trace"].map(
                (label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      onUpdateConfig({ ...config, promptText: PROMPT_PRESETS[idx] })
                    }
                    className="rounded border border-[#242936] bg-[#0F1118] px-2 py-1 text-[11px] text-[#959BAC] transition-colors hover:border-[#D4A359]/60 hover:text-[#E6C080]"
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Delivery Options & Live Test */}
          <div className="space-y-3 border-t border-[#1E222E] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({ ...config, soundEnabled: !config.soundEnabled })
                }
                className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-[#242936] bg-[#151822] px-3 py-1.5 text-xs text-[#D5D1C8] hover:border-[#363D52]"
              >
                {config.soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-[#D4A359]" aria-hidden="true" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-[#7C8292]" aria-hidden="true" />
                )}
                <span>Chime: {config.soundEnabled ? "On" : "Muted"}</span>
              </button>

              {notificationPermission !== "unsupported" && (
                <button
                  type="button"
                  onClick={() => void onRequestBrowserNotifications()}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#242936] bg-[#151822] px-3 py-1.5 text-xs text-[#D5D1C8] hover:border-[#363D52]"
                >
                  <Bell className="h-3.5 w-3.5 text-[#8E94A6]" aria-hidden="true" />
                  <span>
                    {notificationPermission === "granted" &&
                    config.browserNotificationsEnabled
                      ? "Desktop Alerts On"
                      : notificationPermission === "denied"
                        ? "Alerts Blocked in Browser"
                        : "Enable Desktop Alerts"}
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onTestReminder}
              className="w-full min-h-[40px] rounded-lg border border-[#32384A] bg-[#171B26] px-4 py-2 text-xs font-medium text-[#F2F0EB] transition-colors hover:border-[#D4A359]/70 hover:text-[#E6C080]"
            >
              Test Reality Check Reminder Now
            </button>
          </div>
        </section>

        {/* Right Column: Dedicated Lucid Dream Log */}
        <section aria-labelledby="lucid-log-heading" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="lucid-log-heading"
                className="font-editorial text-3xl font-medium text-[#F2F0EB]"
              >
                Lucid Dream Log
              </h2>
              <p className="mt-1 text-sm text-[#959BAC]">
                Dreams where waking awareness emerged—tracking triggers, awareness depth, and conscious intentions.
              </p>
            </div>

            {nonLucidDreams.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedDreamToPromote}
                  onChange={(e) => setSelectedDreamToPromote(e.target.value)}
                  aria-label="Choose an existing dream to mark as lucid"
                  className="h-9 max-w-[210px] rounded-lg border border-[#242936] bg-[#12151E] px-2.5 text-xs text-[#D5D1C8] focus:border-[#D4A359]/70 focus:outline-none"
                >
                  <option value="">Mark an existing dream lucid...</option>
                  {nonLucidDreams.map((d) => (
                    <option key={d.id} value={d.id}>
                      {String(d.entryNumber).padStart(3, "0")} · {d.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedDreamToPromote}
                  onClick={handlePromoteDream}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-[#32384A] bg-[#171B26] px-3 py-1.5 text-xs font-medium text-[#F2F0EB] hover:border-[#D4A359]/70 hover:text-[#E6C080] disabled:opacity-40 whitespace-nowrap"
                >
                  Mark Lucid
                </button>
              </div>
            )}
          </div>

          {lucidDreams.length === 0 ? (
            <div className="rounded-xl border border-[#202430] bg-[#11141B] p-10 text-center space-y-4">
              <Compass className="mx-auto h-7 w-7 text-[#6F7586]" aria-hidden="true" />
              <h3 className="font-editorial text-2xl text-[#F2F0EB]">
                No lucid dreams logged yet
              </h3>
              <p className="mx-auto max-w-md text-sm text-[#8E94A6]">
                Mark any dream entry as lucid from its monograph or select an existing dream above to record your awareness trigger and dream intentions.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {lucidDreams.map((dream) => {
                const lucid = dream.lucidity ?? createEmptyLucidData(true);
                return (
                  <article
                    key={dream.id}
                    className="rounded-xl border border-[#222634] bg-[#11141B] p-6 space-y-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums text-[#83899B]">
                          <span>Entry {String(dream.entryNumber).padStart(3, "0")}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {new Date(dream.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#D4A359]">{lucid.awarenessLevel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{lucid.inductionTechnique}</span>
                        </div>
                        <h3 className="font-editorial text-2xl font-medium text-[#F2F0EB]">
                          {dream.title}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenDream(dream.id)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 self-start text-xs font-medium text-[#D4A359] hover:text-[#E8BF7B] whitespace-nowrap"
                      >
                        <span>Open entry & edit log</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    {lucid.trigger && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-[#83899B]">
                          Lucidity Trigger
                        </p>
                        <p className="text-sm leading-relaxed text-[#D8D4CB]">
                          {lucid.trigger}
                        </p>
                      </div>
                    )}

                    {lucid.experienceNotes && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-[#83899B]">
                          Lucid Experience
                        </p>
                        <p className="text-sm leading-relaxed text-[#A8AEBE]">
                          {lucid.experienceNotes}
                        </p>
                      </div>
                    )}

                    {lucid.intentions.length > 0 && (
                      <div className="space-y-2 border-t border-[#1E222E] pt-4">
                        <p className="text-[11px] font-medium text-[#83899B]">
                          Intentions ({lucid.intentions.filter((i) => i.achieved).length}/
                          {lucid.intentions.length} achieved)
                        </p>
                        <ul className="space-y-1.5">
                          {lucid.intentions.map((intent) => (
                            <li
                              key={intent.id}
                              className="flex items-start gap-2.5 text-xs"
                            >
                              <span
                                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  intent.achieved
                                    ? "border-[#D4A359] bg-[#D4A359]/20 text-[#D4A359]"
                                    : "border-[#32384A] text-[#666C7C]"
                                }`}
                              >
                                {intent.achieved ? (
                                  <Check className="h-2.5 w-2.5" aria-hidden="true" />
                                ) : (
                                  <span className="h-1 w-1 rounded-full bg-[#666C7C]" />
                                )}
                              </span>
                              <span
                                className={
                                  intent.achieved ? "text-[#E6E3DC]" : "text-[#959BAC]"
                                }
                              >
                                {intent.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
