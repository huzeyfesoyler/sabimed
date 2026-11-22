import { useState, useEffect } from "react";
import {
  Maximize2,
  X,
  RefreshCw,
  Loader2,
  MessageSquare,
  AlertCircle,
  Trash2,
  Edit3,
  Check,
  Image as ImageIcon,
  Compass,
} from "lucide-react";
import type {
  ChatMessage,
  DreamEntry,
  ImageAspectRatio,
  ImageResolution,
  LucidDreamData,
  WakingMoodData,
} from "../types/dream";
import { generateDreamArtwork, interpretDreamTranscript } from "../services/dreamApi";
import { TagManager } from "./TagManager";
import { DreamChatPanel } from "./DreamChatPanel";
import { MoodCheckInEditor } from "./MoodCheckInEditor";
import { createEmptyLucidData, LucidDetailsEditor } from "./LucidDetailsEditor";

interface DreamMonographProps {
  dream: DreamEntry;
  allJournalTags: string[];
  onUpdateDream: (updated: DreamEntry) => void;
  onDeleteDream: (id: string) => void;
  onFilterByTag: (tag: string) => void;
}

const RESOLUTIONS: ImageResolution[] = ["1K", "2K", "4K"];
const ASPECT_RATIOS: ImageAspectRatio[] = ["16:9", "4:3", "1:1", "3:4"];

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(sec?: number): string | null {
  if (!sec || sec <= 0) return null;
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${String(rem).padStart(2, "0")} voice note`;
}

export function DreamMonograph({
  dream,
  allJournalTags,
  onUpdateDream,
  onDeleteDream,
  onFilterByTag,
}: DreamMonographProps) {
  const [selectedSize, setSelectedSize] = useState<ImageResolution>(
    dream.imageResolution || "1K"
  );
  const [selectedAspect, setSelectedAspect] = useState<ImageAspectRatio>(
    dream.imageAspectRatio || "16:9"
  );
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [draftTranscript, setDraftTranscript] = useState(dream.transcript);
  const [isReinterpreting, setIsReinterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);

  const [isEditingMood, setIsEditingMood] = useState(false);
  const [draftMood, setDraftMood] = useState<WakingMoodData>(
    dream.wakingMood ?? {
      mood: "Calm",
      rating: 3,
      note: "",
      recordedAt: new Date().toISOString(),
    }
  );

  const [isEditingLucid, setIsEditingLucid] = useState(false);
  const [draftLucid, setDraftLucid] = useState<LucidDreamData>(
    dream.lucidity ?? createEmptyLucidData(true)
  );

  useEffect(() => {
    setSelectedSize(dream.imageResolution || "1K");
    setSelectedAspect(dream.imageAspectRatio || "16:9");
    setDraftTranscript(dream.transcript);
    setIsEditingTranscript(false);
    setImageError(null);
    setInterpretError(null);
    setImageLoadFailed(false);
    setConfirmDelete(false);
    setIsEditingMood(false);
    setDraftMood(
      dream.wakingMood ?? {
        mood: "Calm",
        rating: 3,
        note: "",
        recordedAt: new Date().toISOString(),
      }
    );
    setIsEditingLucid(false);
    setDraftLucid(dream.lucidity ?? createEmptyLucidData(true));
  }, [
    dream.id,
    dream.imageResolution,
    dream.imageAspectRatio,
    dream.transcript,
    dream.wakingMood,
    dream.lucidity,
  ]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen]);

  const handleRegenerateArtwork = async () => {
    if (isGeneratingImage) return;
    setImageError(null);
    setIsGeneratingImage(true);
    try {
      const result = await generateDreamArtwork({
        imagePrompt:
          dream.imagePrompt ||
          `Surrealist fine-art painting evoking ${dream.coreEmotionalTheme}: ${dream.summary}`,
        imageSize: selectedSize,
        aspectRatio: selectedAspect,
      });
      setImageLoadFailed(false);
      onUpdateDream({
        ...dream,
        imageUrl: result.imageDataUrl,
        imageResolution: result.imageSize,
        imageAspectRatio: result.aspectRatio,
      });
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "Failed to generate surrealist artwork."
      );
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSaveTranscript = async (reanalyze: boolean) => {
    const cleaned = draftTranscript.trim();
    if (!cleaned) return;
    setInterpretError(null);

    if (!reanalyze) {
      onUpdateDream({ ...dream, transcript: cleaned });
      setIsEditingTranscript(false);
      return;
    }

    setIsReinterpreting(true);
    try {
      const analysis = await interpretDreamTranscript(cleaned);
      const mergedTags = Array.from(
        new Set([...dream.tags, ...(analysis.suggestedTags ?? [])])
      );
      onUpdateDream({
        ...dream,
        transcript: cleaned,
        title: analysis.title,
        coreEmotionalTheme: analysis.coreEmotionalTheme,
        emotionalTone: analysis.emotionalTone,
        summary: analysis.summary,
        imagePrompt: analysis.imagePrompt,
        archetypes: analysis.archetypes,
        symbols: analysis.symbols,
        tags: mergedTags,
      });
      setIsEditingTranscript(false);
    } catch (err) {
      setInterpretError(
        err instanceof Error ? err.message : "Unable to re-interpret dream transcript."
      );
    } finally {
      setIsReinterpreting(false);
    }
  };

  const handleAskAboutSymbol = (symbolName: string) => {
    setChatPrefill(
      `What might the symbol "${symbolName}" represent in this dream, and how does it connect to the core emotional theme?`
    );
    const el = document.getElementById("symbol-dialogue");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleUpdateChatHistory = (_dreamId: string, nextHistory: ChatMessage[]) => {
    onUpdateDream({
      ...dream,
      chatHistory: nextHistory,
    });
  };

  const durationText = formatDuration(dream.recordedDurationSec);

  return (
    <article className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12 space-y-12">
      {/* 1. Archival Monograph Header */}
      <header className="space-y-5 border-b border-[#202430] pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums text-[#83899B]">
            <span>Entry {String(dream.entryNumber).padStart(3, "0")}</span>
            <span aria-hidden="true">·</span>
            <span>{formatLongDate(dream.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatClockTime(dream.createdAt)}</span>
            {durationText && (
              <>
                <span aria-hidden="true">·</span>
                <span>{durationText}</span>
              </>
            )}
            {dream.wakingMood && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Waking Mood: {dream.wakingMood.mood} ({dream.wakingMood.rating}/5)
                </span>
              </>
            )}
            {dream.lucidity?.isLucid && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#D4A359]">
                  Lucid · {dream.lucidity.awarenessLevel}
                </span>
              </>
            )}
          </div>

          {/* Two-step inline delete confirmation */}
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <div className="inline-flex items-center gap-2 text-xs">
                <span className="text-[#C8C5BC]">Delete this entry?</span>
                <button
                  type="button"
                  onClick={() => onDeleteDream(dream.id)}
                  className="rounded-md border border-[#6E2D2D] bg-[#2D1416] px-2.5 py-1 font-medium text-[#F5B7B1] hover:bg-[#3B191C] whitespace-nowrap"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-[#262B38] px-2.5 py-1 text-[#9DA3B4] hover:text-[#F2F0EB] whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-[#7E8496] transition-colors hover:bg-[#171A24] hover:text-[#E5989B] whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        <h1 className="font-editorial text-4xl font-medium leading-[1.12] tracking-tight text-[#F6F4EF] sm:text-5xl">
          {dream.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[#A5ABB9]">
          <span className="text-[#D4A359] font-medium">{dream.coreEmotionalTheme}</span>
          {dream.emotionalTone.length > 0 && (
            <>
              <span aria-hidden="true" className="text-[#4B5163]">
                ·
              </span>
              <span>{dream.emotionalTone.join(" · ")}</span>
            </>
          )}
        </div>

        {/* Multi-Tag Editor */}
        <div className="pt-1">
          <TagManager
            tags={dream.tags}
            allJournalTags={allJournalTags}
            onChangeTags={(nextTags) => onUpdateDream({ ...dream, tags: nextTags })}
            onTagClick={onFilterByTag}
          />
        </div>
      </header>

      {/* 2. Surrealist Dream Artwork (Focal Visual Anchor) */}
      <section aria-label="Surrealist dream artwork" className="space-y-4">
        <div className="group relative overflow-hidden rounded-xl border border-[#232735] bg-[#12141C]">
          {dream.imageUrl && !imageLoadFailed ? (
            <div
              className={`relative w-full overflow-hidden bg-[#0E1016] ${
                dream.imageAspectRatio === "1:1"
                  ? "aspect-square max-h-[580px] mx-auto"
                  : dream.imageAspectRatio === "4:3"
                    ? "aspect-[4/3]"
                    : dream.imageAspectRatio === "3:4"
                      ? "aspect-[3/4] max-h-[640px] mx-auto"
                      : "aspect-video"
              }`}
            >
              <img
                src={dream.imageUrl}
                alt={`Surrealist painting representing ${dream.title}: ${dream.coreEmotionalTheme}`}
                referrerPolicy="no-referrer"
                onError={() => setImageLoadFailed(true)}
                className="h-full w-full object-cover transition-transform duration-300"
              />

              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="Inspect artwork fullscreen"
                className="absolute right-3.5 top-3.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#0B0C10]/75 px-3 py-2 text-xs font-medium text-[#F2F0EB] backdrop-blur-sm transition-colors hover:bg-[#0B0C10]/95"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Inspect</span>
              </button>
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#141722] via-[#101219] to-[#191614] p-8 text-center">
              <ImageIcon className="h-7 w-7 text-[#6E7487]" aria-hidden="true" />
              <div className="space-y-1 max-w-md">
                <p className="font-editorial text-2xl text-[#E8E5DE]">{dream.title}</p>
                <p className="text-xs text-[#8C92A4]">
                  No surrealist painting is currently rendered for this entry. Select a resolution below to paint its core emotional theme.
                </p>
              </div>
            </div>
          )}

          {isGeneratingImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0B0C10]/80 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-[#D4A359]" aria-hidden="true" />
              <p className="text-sm font-medium text-[#F2F0EB]">
                Painting surrealist canvas at {selectedSize} resolution...
              </p>
              <p className="text-xs text-[#959BAC]">
                Rendering {dream.coreEmotionalTheme}
              </p>
            </div>
          )}
        </div>

        {/* Caption + Resolution Affordance (1K / 2K / 4K) & Regenerate Controls */}
        <div className="flex flex-col gap-4 border-b border-[#202430] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-editorial text-sm italic text-[#959BAC]">
            Fig. {String(dream.entryNumber).padStart(2, "0")} — Surrealist interpretation of “
            {dream.coreEmotionalTheme}” ({dream.imageResolution})
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Resolution Selector: 1K / 2K / 4K */}
            <div
              role="group"
              aria-label="Image resolution"
              className="inline-flex items-center rounded-lg border border-[#242936] bg-[#11141C] p-0.5"
            >
              {RESOLUTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  disabled={isGeneratingImage}
                  className={`rounded-md px-2.5 py-1.5 font-mono text-xs font-medium tabular-nums transition-colors whitespace-nowrap ${
                    selectedSize === size
                      ? "bg-[#232837] text-[#E6C080]"
                      : "text-[#8A90A2] hover:text-[#E2DFD7]"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            {/* Aspect Ratio Selector */}
            <select
              value={selectedAspect}
              onChange={(e) => setSelectedAspect(e.target.value as ImageAspectRatio)}
              disabled={isGeneratingImage}
              aria-label="Artwork aspect ratio"
              className="h-9 rounded-lg border border-[#242936] bg-[#11141C] px-2.5 font-mono text-xs text-[#D5D1C8] focus:border-[#D4A359]/70 focus:outline-none"
            >
              {ASPECT_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleRegenerateArtwork}
              disabled={isGeneratingImage}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#343A4C] bg-[#171B26] px-3.5 py-1.5 text-xs font-medium text-[#F2F0EB] transition-colors hover:border-[#D4A359]/70 hover:text-[#E6C080] disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isGeneratingImage ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>{dream.imageUrl ? "Regenerate Artwork" : "Generate Artwork"}</span>
            </button>
          </div>
        </div>

        {imageError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-[#5B2A2A] bg-[#241416] px-4 py-3 text-xs text-[#F2B8B5]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC5A5A]" aria-hidden="true" />
            <span>{imageError}</span>
          </div>
        )}
      </section>

      {/* 3. Structured Psychological Interpretation (Directly below the image) */}
      <section aria-labelledby="interpretation-heading" className="space-y-10">
        <div className="space-y-3">
          <p className="text-xs font-medium text-[#8A90A2]">
            Jungian Psychological Interpretation
          </p>
          <h2
            id="interpretation-heading"
            className="font-editorial text-3xl font-medium text-[#F2F0EB]"
          >
            Archetypal Reading & Synthesis
          </h2>
          <p className="max-w-prose text-[15px] leading-[1.8] text-[#D8D4CB]">
            {dream.summary}
          </p>
        </div>

        {/* Recognized Archetypes Grid */}
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-[#8A90A2]">
            Recognized Archetypes ({dream.archetypes.length})
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            {dream.archetypes.map((archetype, index) => (
              <div
                key={`${archetype.name}-${index}`}
                className="flex flex-col justify-between space-y-4 rounded-xl border border-[#222634] bg-[#11141B] p-6"
              >
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-xs tabular-nums text-[#D4A359]">
                      {String(index + 1).padStart(2, "0")}.
                    </span>
                    <h4 className="font-editorial text-2xl font-medium text-[#F2F0EB]">
                      {archetype.name}
                    </h4>
                  </div>

                  <div className="space-y-2 text-sm leading-relaxed">
                    <p className="text-[#B8BCC8]">
                      <span className="font-medium text-[#E8E5DE]">In the dream: </span>
                      {archetype.manifestation}
                    </p>
                    <p className="text-[#9FA5B5]">{archetype.psychologicalMeaning}</p>
                  </div>
                </div>

                <div className="border-t border-[#1E222E] pt-3.5">
                  <p className="font-editorial text-[15px] italic leading-relaxed text-[#E3CAA0]">
                    “{archetype.integrationPrompt}”
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Symbols Lexicon */}
        {dream.symbols.length > 0 && (
          <div className="space-y-4 border-t border-[#202430] pt-8">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-editorial text-2xl font-medium text-[#F2F0EB]">
                Key Symbols in This Dream
              </h3>
              <span className="text-xs text-[#7E8496]">
                Select any symbol to explore it in dialogue
              </span>
            </div>

            <dl className="divide-y divide-[#1E222E] border-y border-[#1E222E]">
              {dream.symbols.map((item) => (
                <div
                  key={item.symbol}
                  className="grid gap-3 py-4 sm:grid-cols-[200px_1fr_auto] sm:items-start sm:gap-6"
                >
                  <dt className="font-editorial text-xl font-medium text-[#F2F0EB]">
                    {item.symbol}
                  </dt>
                  <dd className="space-y-1 text-sm leading-relaxed">
                    <p className="text-[#959BAC]">{item.context}</p>
                    <p className="text-[#D8D4CB]">{item.meaning}</p>
                  </dd>
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleAskAboutSymbol(item.symbol)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-[#262B38] bg-[#141720] px-3 py-1.5 text-xs font-medium text-[#D6D3CB] transition-colors hover:border-[#D4A359]/70 hover:text-[#E6C080] whitespace-nowrap"
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Ask about symbol</span>
                    </button>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>

      {/* 4. Waking Mood & Lucid Dream Log */}
      <section
        aria-labelledby="mood-lucidity-heading"
        className="space-y-6 border-t border-[#202430] pt-10"
      >
        <div>
          <p className="text-xs font-medium text-[#8A90A2]">
            Waking Reflection & Awareness
          </p>
          <h2
            id="mood-lucidity-heading"
            className="mt-0.5 font-editorial text-2xl font-medium text-[#F2F0EB]"
          >
            Waking Mood & Lucidity Log
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Waking Mood Panel */}
          <div className="rounded-xl border border-[#222634] bg-[#11141B] p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-editorial text-2xl font-medium text-[#F2F0EB]">
                Waking Mood
              </h3>
              {!isEditingMood && (
                <button
                  type="button"
                  onClick={() => setIsEditingMood(true)}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#252A38] px-3 py-1 text-xs text-[#9EA4B4] transition-colors hover:border-[#D4A359]/60 hover:text-[#F2F0EB] whitespace-nowrap"
                >
                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{dream.wakingMood ? "Edit mood" : "Log mood"}</span>
                </button>
              )}
            </div>

            {isEditingMood ? (
              <div className="space-y-4">
                <MoodCheckInEditor
                  value={draftMood}
                  onChange={setDraftMood}
                  compact
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateDream({
                        ...dream,
                        wakingMood: {
                          ...draftMood,
                          recordedAt: new Date().toISOString(),
                        },
                      });
                      setIsEditingMood(false);
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#D4A359] px-3.5 py-1.5 text-xs font-semibold text-[#0B0C10] hover:bg-[#DFB26E]"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Save Mood</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftMood(
                        dream.wakingMood ?? {
                          mood: "Calm",
                          rating: 3,
                          note: "",
                          recordedAt: new Date().toISOString(),
                        }
                      );
                      setIsEditingMood(false);
                    }}
                    className="inline-flex min-h-[36px] items-center rounded-lg px-3 py-1.5 text-xs text-[#8A90A2] hover:text-[#F2F0EB]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : dream.wakingMood ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-4 border-b border-[#1D212D] pb-3">
                  <span className="font-editorial text-3xl font-medium text-[#E6C080]">
                    {dream.wakingMood.mood}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-[#D8D4CB]">
                    {dream.wakingMood.rating} / 5 rating
                  </span>
                </div>
                <div className="flex gap-1.5" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <span
                      key={step}
                      className={`h-1.5 flex-1 rounded-full ${
                        step <= (dream.wakingMood?.rating ?? 0)
                          ? "bg-[#D4A359]"
                          : "bg-[#1F2432]"
                      }`}
                    />
                  ))}
                </div>
                {dream.wakingMood.note ? (
                  <p className="text-sm leading-relaxed text-[#A5ABB9]">
                    {dream.wakingMood.note}
                  </p>
                ) : (
                  <p className="text-xs text-[#73798A]">
                    No additional waking mood note recorded.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-[#8E94A6]">
                  No waking mood logged for this dream yet. Select how you felt upon waking and rate its clarity to track patterns over time.
                </p>
                <button
                  type="button"
                  onClick={() => setIsEditingMood(true)}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-[#303647] bg-[#161923] px-3.5 py-1.5 text-xs font-medium text-[#F2F0EB] hover:border-[#D4A359]/70 hover:text-[#E6C080]"
                >
                  Log Waking Mood
                </button>
              </div>
            )}
          </div>

          {/* Lucid Dream Panel */}
          <div className="rounded-xl border border-[#222634] bg-[#11141B] p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-editorial text-2xl font-medium text-[#F2F0EB]">
                  Lucid Dream Log
                </h3>
              </div>

              {!isEditingLucid && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftLucid(dream.lucidity ?? createEmptyLucidData(true));
                    setIsEditingLucid(true);
                  }}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#252A38] px-3 py-1 text-xs text-[#9EA4B4] transition-colors hover:border-[#D4A359]/60 hover:text-[#F2F0EB] whitespace-nowrap"
                >
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {dream.lucidity?.isLucid ? "Edit lucid log" : "Mark as lucid"}
                  </span>
                </button>
              )}
            </div>

            {isEditingLucid ? (
              <div className="space-y-4">
                <LucidDetailsEditor
                  value={draftLucid}
                  onChange={setDraftLucid}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateDream({
                          ...dream,
                          lucidity: { ...draftLucid, isLucid: true },
                        });
                        setIsEditingLucid(false);
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#D4A359] px-3.5 py-1.5 text-xs font-semibold text-[#0B0C10] hover:bg-[#DFB26E]"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Save Lucid Log</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingLucid(false)}
                      className="inline-flex min-h-[36px] items-center rounded-lg px-3 py-1.5 text-xs text-[#8A90A2] hover:text-[#F2F0EB]"
                    >
                      Cancel
                    </button>
                  </div>
                  {dream.lucidity?.isLucid && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateDream({ ...dream, lucidity: undefined });
                        setIsEditingLucid(false);
                      }}
                      className="text-xs text-[#C97B7B] hover:text-[#E5989B]"
                    >
                      Remove lucid mark
                    </button>
                  )}
                </div>
              </div>
            ) : dream.lucidity?.isLucid ? (
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#9EA4B4] border-b border-[#1D212D] pb-3">
                  <span className="text-[#D4A359] font-medium">
                    {dream.lucidity.awarenessLevel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{dream.lucidity.inductionTechnique}</span>
                </div>

                {dream.lucidity.trigger && (
                  <p className="text-xs leading-relaxed text-[#C6C3BA]">
                    <span className="font-medium text-[#F2F0EB]">Trigger: </span>
                    {dream.lucidity.trigger}
                  </p>
                )}

                {dream.lucidity.experienceNotes && (
                  <p className="text-xs leading-relaxed text-[#9FA5B5]">
                    {dream.lucidity.experienceNotes}
                  </p>
                )}

                {dream.lucidity.intentions.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] font-medium text-[#83899B]">
                      Dream Intentions
                    </p>
                    <ul className="space-y-1.5">
                      {dream.lucidity.intentions.map((intent) => (
                        <li key={intent.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!dream.lucidity) return;
                              onUpdateDream({
                                ...dream,
                                lucidity: {
                                  ...dream.lucidity,
                                  intentions: dream.lucidity.intentions.map((i) =>
                                    i.id === intent.id
                                      ? { ...i, achieved: !i.achieved }
                                      : i
                                  ),
                                },
                              });
                            }}
                            className="flex w-full items-start gap-2 text-left text-xs text-[#D5D1C8] hover:text-[#F2F0EB]"
                          >
                            <span
                              className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                intent.achieved
                                  ? "border-[#D4A359] bg-[#D4A359] text-[#0B0C10]"
                                  : "border-[#384052]"
                              }`}
                            >
                              {intent.achieved && (
                                <Check className="h-2.5 w-2.5" aria-hidden="true" />
                              )}
                            </span>
                            <span>{intent.text}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-[#8E94A6]">
                  Not marked as a lucid dream. If you became aware you were dreaming during this entry, log your awareness level, trigger, and intentions.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDraftLucid(createEmptyLucidData(true));
                    setIsEditingLucid(true);
                  }}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-[#303647] bg-[#161923] px-3.5 py-1.5 text-xs font-medium text-[#F2F0EB] hover:border-[#D4A359]/70 hover:text-[#E6C080]"
                >
                  Mark as Lucid Dream
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. Waking Voice Transcript */}
      <section
        aria-labelledby="transcript-heading"
        className="space-y-4 border-t border-[#202430] pt-10"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#8A90A2]">Primary Record</p>
            <h2
              id="transcript-heading"
              className="mt-0.5 font-editorial text-2xl font-medium text-[#F2F0EB]"
            >
              Waking Transcript
            </h2>
          </div>

          {!isEditingTranscript && (
            <button
              type="button"
              onClick={() => setIsEditingTranscript(true)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-[#252A38] px-3 py-1.5 text-xs text-[#9EA4B4] transition-colors hover:border-[#3A4154] hover:text-[#F2F0EB] whitespace-nowrap"
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Edit transcript</span>
            </button>
          )}
        </div>

        {isEditingTranscript ? (
          <div className="space-y-3">
            <textarea
              rows={6}
              value={draftTranscript}
              onChange={(e) => setDraftTranscript(e.target.value)}
              aria-label="Edit waking dream transcript"
              className="w-full rounded-xl border border-[#2A3040] bg-[#12151E] p-4 text-sm leading-relaxed text-[#F2F0EB] focus:border-[#D4A359]/70 focus:outline-none"
            />
            {interpretError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[#5B2A2A] bg-[#241416] px-3.5 py-2.5 text-xs text-[#F2B8B5]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC5A5A]" aria-hidden="true" />
                <span>{interpretError}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={isReinterpreting || !draftTranscript.trim()}
                onClick={() => void handleSaveTranscript(false)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#303647] bg-[#161923] px-3.5 py-2 text-xs font-medium text-[#F2F0EB] hover:border-[#D4A359]/60 disabled:opacity-50 whitespace-nowrap"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Save text only</span>
              </button>
              <button
                type="button"
                disabled={isReinterpreting || draftTranscript.trim().length < 10}
                onClick={() => void handleSaveTranscript(true)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#D4A359] px-4 py-2 text-xs font-semibold text-[#0B0C10] hover:bg-[#DFB26E] disabled:opacity-50 whitespace-nowrap"
              >
                {isReinterpreting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Save & Re-interpret</span>
              </button>
              <button
                type="button"
                disabled={isReinterpreting}
                onClick={() => {
                  setDraftTranscript(dream.transcript);
                  setIsEditingTranscript(false);
                }}
                className="inline-flex min-h-[38px] items-center rounded-lg px-3 py-2 text-xs text-[#8A90A2] hover:text-[#F2F0EB] whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="max-w-prose text-[15.5px] leading-[1.85] text-[#D8D4CB] first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-editorial first-letter:text-5xl first-letter:font-medium first-letter:leading-none first-letter:text-[#D4A359]">
            {dream.transcript}
          </p>
        )}
      </section>

      {/* 5. Multi-Turn Symbol Dialogue */}
      <DreamChatPanel
        dream={dream}
        prefillPrompt={chatPrefill}
        onConsumePrefill={() => setChatPrefill(null)}
        onUpdateChatHistory={handleUpdateChatHistory}
      />

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && dream.imageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Fullscreen artwork for ${dream.title}`}
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06070A]/92 p-4 sm:p-8 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] max-w-6xl space-y-3"
          >
            <div className="flex items-center justify-between gap-6">
              <div>
                <h3 className="font-editorial text-2xl text-[#F2F0EB]">{dream.title}</h3>
                <p className="text-xs text-[#8E94A6]">
                  {dream.coreEmotionalTheme} · {dream.imageResolution} ({dream.imageAspectRatio})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                aria-label="Close fullscreen viewer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-[#12141C] text-[#F2F0EB] hover:border-[#D4A359]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <img
              src={dream.imageUrl}
              alt={`Surrealist painting representing ${dream.title}`}
              referrerPolicy="no-referrer"
              className="max-h-[78vh] w-auto rounded-lg border border-[#252A38] object-contain"
            />
          </div>
        </div>
      )}
    </article>
  );
}
