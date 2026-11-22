/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { PanelLeftOpen, X, Mic } from "lucide-react";
import type {
  AppView,
  DreamEntry,
  RealityCheckConfig,
  WakingMoodType,
} from "./types/dream";
import {
  deleteDreamById,
  extractTagCounts,
  getTodayIsoDate,
  loadAllDreams,
  loadRealityCheckConfig,
  normalizeTag,
  saveDream,
  saveRealityCheckConfig,
  searchAndFilterDreams,
} from "./services/dreamStorage";
import { TopBar } from "./components/TopBar";
import { DreamSidebar } from "./components/DreamSidebar";
import { DreamMonograph } from "./components/DreamMonograph";
import { DreamCaptureModal } from "./components/DreamCaptureModal";
import { ArchiveGalleryView } from "./components/ArchiveGalleryView";
import { ArchetypesIndexView } from "./components/ArchetypesIndexView";
import { LucidityView } from "./components/LucidityView";
import { RealityCheckBanner } from "./components/RealityCheckBanner";
import { createEmptyLucidData } from "./components/LucidDetailsEditor";

function parseMinutesOfDay(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function formatMinutesOfDay(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function computeNextReminderLabel(config: RealityCheckConfig, now: Date): string | null {
  if (!config.enabled) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (config.scheduleMode === "times") {
    const sorted = [...config.customTimes].sort();
    if (sorted.length === 0) return "No times set";
    const upcoming = sorted.find((t) => parseMinutesOfDay(t) > nowMin);
    return upcoming ? `Today at ${upcoming}` : `Tomorrow at ${sorted[0]}`;
  }

  const startMin = parseMinutesOfDay(config.startTime);
  const endMin = parseMinutesOfDay(config.endTime);
  const step = Math.max(15, config.intervalMinutes || 60);

  if (nowMin < startMin) {
    return `Today at ${formatMinutesOfDay(startMin)}`;
  }
  if (nowMin >= endMin) {
    return `Tomorrow at ${formatMinutesOfDay(startMin)}`;
  }

  const elapsed = nowMin - startMin;
  const nextSlot = startMin + (Math.floor(elapsed / step) + 1) * step;
  if (nextSlot <= endMin) {
    return `Today at ${formatMinutesOfDay(nextSlot)}`;
  }
  return `Tomorrow at ${formatMinutesOfDay(startMin)}`;
}

function playGentleChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(528, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.35);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.95);
    window.setTimeout(() => void ctx.close().catch(() => undefined), 1100);
  } catch {
    // Audio playback blocked before interaction
  }
}

export default function App() {
  const [dreams, setDreams] = useState<DreamEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("journal");
  const [activeDreamId, setActiveDreamId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<WakingMoodType | null>(null);
  const [lucidOnly, setLucidOnly] = useState(false);

  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Reality Check Reminders state
  const [rcConfig, setRcConfig] = useState<RealityCheckConfig>(() =>
    loadRealityCheckConfig()
  );
  const [activeReminderBanner, setActiveReminderBanner] = useState(false);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const lastFiredMinuteKeyRef = useRef<string | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );

  useEffect(() => {
    let mounted = true;
    void loadAllDreams().then((loaded) => {
      if (!mounted) return;
      setDreams(loaded);
      if (loaded.length > 0) {
        setActiveDreamId(loaded[0].id);
      }
      setIsLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const updateRealityCheckConfig = useCallback((next: RealityCheckConfig) => {
    setRcConfig(next);
    saveRealityCheckConfig(next);
  }, []);

  const fireRealityCheckReminder = useCallback(
    (config: RealityCheckConfig) => {
      setActiveReminderBanner(true);
      if (config.soundEnabled) {
        playGentleChime();
      }
      if (
        config.browserNotificationsEnabled &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification("Oneira — Reality Check", {
            body: config.promptText,
          });
        } catch {
          // Fallback to in-app banner already shown
        }
      }
    },
    []
  );

  // Live Reality Check scheduler polling every 15 seconds
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = new Date();
      setClockTick(now.getTime());

      if (!rcConfig.enabled) return;

      const minuteKey = `${getTodayIsoDate()}-${now.getHours()}:${now.getMinutes()}`;
      if (lastFiredMinuteKeyRef.current === minuteKey) return;

      const nowMin = now.getHours() * 60 + now.getMinutes();
      let shouldFire = false;

      if (rcConfig.scheduleMode === "times") {
        const currentHHMM = formatMinutesOfDay(nowMin);
        shouldFire = rcConfig.customTimes.includes(currentHHMM);
      } else {
        const startMin = parseMinutesOfDay(rcConfig.startTime);
        const endMin = parseMinutesOfDay(rcConfig.endTime);
        const step = Math.max(15, rcConfig.intervalMinutes || 60);
        if (nowMin >= startMin && nowMin <= endMin) {
          shouldFire = (nowMin - startMin) % step === 0;
        }
      }

      if (shouldFire) {
        lastFiredMinuteKeyRef.current = minuteKey;
        fireRealityCheckReminder(rcConfig);
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [rcConfig, fireRealityCheckReminder]);

  const nextReminderLabel = useMemo(
    () => computeNextReminderLabel(rcConfig, new Date(clockTick)),
    [rcConfig, clockTick]
  );

  const handleRequestBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      updateRealityCheckConfig({
        ...rcConfig,
        browserNotificationsEnabled: !rcConfig.browserNotificationsEnabled,
      });
      return;
    }
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    if (result === "granted") {
      updateRealityCheckConfig({
        ...rcConfig,
        browserNotificationsEnabled: true,
      });
    }
  };

  const handleCompleteRealityCheck = () => {
    const today = getTodayIsoDate();
    const baseCount =
      rcConfig.completedTodayDate === today ? rcConfig.completedTodayCount : 0;
    updateRealityCheckConfig({
      ...rcConfig,
      completedTodayDate: today,
      completedTodayCount: baseCount + 1,
      lastTriggeredAt: new Date().toISOString(),
    });
    setActiveReminderBanner(false);
  };

  const tagCounts = useMemo(() => extractTagCounts(dreams), [dreams]);
  const allJournalTags = useMemo(() => tagCounts.map((t) => t.tag), [tagCounts]);

  const filteredDreams = useMemo(
    () =>
      searchAndFilterDreams(
        dreams,
        searchQuery,
        selectedTags,
        selectedArchetype,
        selectedMood,
        lucidOnly
      ),
    [dreams, searchQuery, selectedTags, selectedArchetype, selectedMood, lucidOnly]
  );

  const activeDream = useMemo(() => {
    if (!activeDreamId) return filteredDreams[0] ?? dreams[0] ?? null;
    return (
      dreams.find((d) => d.id === activeDreamId) ??
      filteredDreams[0] ??
      dreams[0] ??
      null
    );
  }, [dreams, filteredDreams, activeDreamId]);

  const nextEntryNumber = useMemo(() => {
    const maxNumber = dreams.reduce(
      (max, d) => (d.entryNumber > max ? d.entryNumber : max),
      0
    );
    return maxNumber + 1;
  }, [dreams]);

  const handleToggleTag = (rawTag: string) => {
    const clean = normalizeTag(rawTag);
    if (!clean) return;
    setSelectedTags((prev) =>
      prev.includes(clean) ? prev.filter((t) => t !== clean) : [...prev, clean]
    );
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedTags([]);
    setSelectedArchetype(null);
    setSelectedMood(null);
    setLucidOnly(false);
  };

  const handleDreamCreated = (newDream: DreamEntry) => {
    setDreams((prev) => [newDream, ...prev]);
    setActiveDreamId(newDream.id);
    setActiveView("journal");
    handleClearFilters();
    void saveDream(newDream);
  };

  const handleUpdateDream = (updated: DreamEntry) => {
    setDreams((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    void saveDream(updated);
  };

  const handleDeleteDream = (id: string) => {
    setDreams((prev) => {
      const remaining = prev.filter((d) => d.id !== id);
      if (activeDreamId === id) {
        setActiveDreamId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
    void deleteDreamById(id);
  };

  const handleMarkDreamLucidFromView = (dreamId: string) => {
    const target = dreams.find((d) => d.id === dreamId);
    if (!target) return;
    const updated: DreamEntry = {
      ...target,
      lucidity: target.lucidity
        ? { ...target.lucidity, isLucid: true }
        : createEmptyLucidData(true),
    };
    handleUpdateDream(updated);
  };

  const handleFilterByTagFromMonograph = (tag: string) => {
    const clean = normalizeTag(tag);
    setSelectedTags([clean]);
    setSelectedArchetype(null);
    setSelectedMood(null);
    setLucidOnly(false);
    setActiveView("archive");
  };

  const handleOpenDreamFromArchive = (id: string) => {
    setActiveDreamId(id);
    setActiveView("journal");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectArchetypeFromIndex = (archetypeName: string) => {
    setSelectedArchetype(archetypeName);
    setSelectedTags([]);
    setSelectedMood(null);
    setLucidOnly(false);
    setSearchQuery("");
    setActiveView("archive");
  };

  const handleSelectTagFromIndex = (tag: string) => {
    setSelectedTags([normalizeTag(tag)]);
    setSelectedArchetype(null);
    setSelectedMood(null);
    setLucidOnly(false);
    setSearchQuery("");
    setActiveView("archive");
  };

  const handleSelectMoodFromIndex = (mood: WakingMoodType) => {
    setSelectedMood(mood);
    setSelectedTags([]);
    setSelectedArchetype(null);
    setLucidOnly(false);
    setSearchQuery("");
    setActiveView("archive");
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#F2F0EB] flex flex-col">
      <TopBar
        activeView={activeView}
        onNavigate={(view) => {
          setActiveView(view);
          setMobileSidebarOpen(false);
        }}
        onOpenCapture={() => setIsCaptureOpen(true)}
      />

      {!isLoaded ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <p className="font-editorial text-2xl text-[#8D93A5]">
            Opening dream journal...
          </p>
        </div>
      ) : activeView === "journal" ? (
        <div className="mx-auto flex w-full max-w-[1440px] flex-1">
          {/* Desktop Left Archive & Search Rail */}
          <div className="hidden lg:block lg:w-[320px] xl:w-[340px] shrink-0 sticky top-16 h-[calc(100vh-4rem)]">
            <DreamSidebar
              dreams={filteredDreams}
              totalDreamCount={dreams.length}
              activeDreamId={activeDream?.id ?? null}
              searchQuery={searchQuery}
              selectedTags={selectedTags}
              selectedArchetype={selectedArchetype}
              lucidOnly={lucidOnly}
              tagCounts={tagCounts}
              onSearchChange={setSearchQuery}
              onToggleTag={handleToggleTag}
              onToggleLucidOnly={() => setLucidOnly((prev) => !prev)}
              onClearFilters={handleClearFilters}
              onSelectDream={(id) => setActiveDreamId(id)}
            />
          </div>

          {/* Mobile Drawer Trigger */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between border-b border-[#202430] px-4 py-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#252A38] bg-[#12151E] px-3 py-2 text-xs font-medium text-[#E6E3DC]"
              >
                <PanelLeftOpen className="h-4 w-4 text-[#D4A359]" aria-hidden="true" />
                <span>
                  Search & Entries ({filteredDreams.length})
                </span>
              </button>
              {(selectedTags.length > 0 ||
                searchQuery.trim().length > 0 ||
                lucidOnly ||
                Boolean(selectedMood)) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-medium text-[#D4A359]"
                >
                  Clear filters
                </button>
              )}
            </div>

            {activeDream ? (
              <DreamMonograph
                dream={activeDream}
                allJournalTags={allJournalTags}
                onUpdateDream={handleUpdateDream}
                onDeleteDream={handleDeleteDream}
                onFilterByTag={handleFilterByTagFromMonograph}
              />
            ) : (
              <div className="mx-auto flex max-w-xl flex-col items-center justify-center px-6 py-28 text-center space-y-5">
                <h1 className="font-editorial text-4xl font-medium text-[#F2F0EB]">
                  Capture Your First Dream
                </h1>
                <p className="text-sm leading-relaxed text-[#959BAC]">
                  Record a voice note the moment you wake. Oneira will transcribe your narration, paint a surrealist interpretation of its core emotional theme, and map its Jungian archetypes.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCaptureOpen(true)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#D4A359] px-5 py-2.5 text-sm font-semibold text-[#0B0C10] hover:bg-[#DFB26E]"
                >
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  <span>Record Dream</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Slide-Over Archive Drawer */}
          {mobileSidebarOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Dream entries and search"
              className="fixed inset-0 z-40 flex lg:hidden"
            >
              <div
                onClick={() => setMobileSidebarOpen(false)}
                className="fixed inset-0 bg-[#050609]/80 backdrop-blur-sm"
              />
              <div className="relative z-10 flex h-full w-[86vw] max-w-sm flex-col bg-[#0D0F14] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#202430] px-4 py-3.5">
                  <span className="font-editorial text-xl text-[#F2F0EB]">
                    Journal Index
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    aria-label="Close journal index"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#252A38] text-[#9EA4B4]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <DreamSidebar
                    dreams={filteredDreams}
                    totalDreamCount={dreams.length}
                    activeDreamId={activeDream?.id ?? null}
                    searchQuery={searchQuery}
                    selectedTags={selectedTags}
                    selectedArchetype={selectedArchetype}
                    lucidOnly={lucidOnly}
                    tagCounts={tagCounts}
                    onSearchChange={setSearchQuery}
                    onToggleTag={handleToggleTag}
                    onToggleLucidOnly={() => setLucidOnly((prev) => !prev)}
                    onClearFilters={handleClearFilters}
                    onSelectDream={(id) => {
                      setActiveDreamId(id);
                      setMobileSidebarOpen(false);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeView === "archive" ? (
        <ArchiveGalleryView
          dreams={filteredDreams}
          totalDreamCount={dreams.length}
          searchQuery={searchQuery}
          selectedTags={selectedTags}
          selectedArchetype={selectedArchetype}
          selectedMood={selectedMood}
          lucidOnly={lucidOnly}
          tagCounts={tagCounts}
          onSearchChange={setSearchQuery}
          onToggleTag={handleToggleTag}
          onMoodChange={setSelectedMood}
          onToggleLucidOnly={() => setLucidOnly((prev) => !prev)}
          onClearFilters={handleClearFilters}
          onOpenDream={handleOpenDreamFromArchive}
          onOpenCapture={() => setIsCaptureOpen(true)}
        />
      ) : activeView === "lucidity" ? (
        <LucidityView
          dreams={dreams}
          config={rcConfig}
          nextReminderLabel={nextReminderLabel}
          notificationPermission={notificationPermission}
          onUpdateConfig={updateRealityCheckConfig}
          onRequestBrowserNotifications={handleRequestBrowserNotifications}
          onTestReminder={() => fireRealityCheckReminder(rcConfig)}
          onLogManualCheck={handleCompleteRealityCheck}
          onOpenDream={handleOpenDreamFromArchive}
          onMarkDreamLucid={handleMarkDreamLucidFromView}
          onOpenLucidCapture={() => setIsCaptureOpen(true)}
        />
      ) : (
        <ArchetypesIndexView
          dreams={dreams}
          tagCounts={tagCounts}
          onSelectArchetype={handleSelectArchetypeFromIndex}
          onSelectTag={handleSelectTagFromIndex}
          onSelectMood={handleSelectMoodFromIndex}
        />
      )}

      <DreamCaptureModal
        isOpen={isCaptureOpen}
        nextEntryNumber={nextEntryNumber}
        allJournalTags={allJournalTags}
        onClose={() => setIsCaptureOpen(false)}
        onDreamCreated={handleDreamCreated}
      />

      {activeReminderBanner && (
        <RealityCheckBanner
          promptText={rcConfig.promptText}
          completedTodayCount={rcConfig.completedTodayCount}
          onComplete={handleCompleteRealityCheck}
          onDismiss={() => setActiveReminderBanner(false)}
        />
      )}
    </div>
  );
}
