import { useState } from "react";
import { Search, X, ArrowUpDown, Image as ImageIcon } from "lucide-react";
import {
  PREDEFINED_MOODS,
  type DreamEntry,
  type WakingMoodType,
} from "../types/dream";

interface ArchiveGalleryViewProps {
  dreams: DreamEntry[];
  totalDreamCount: number;
  searchQuery: string;
  selectedTags: string[];
  selectedArchetype: string | null;
  selectedMood: WakingMoodType | null;
  lucidOnly: boolean;
  tagCounts: Array<{ tag: string; count: number }>;
  onSearchChange: (value: string) => void;
  onToggleTag: (tag: string) => void;
  onMoodChange: (mood: WakingMoodType | null) => void;
  onToggleLucidOnly: () => void;
  onClearFilters: () => void;
  onOpenDream: (id: string) => void;
  onOpenCapture: () => void;
}

export function ArchiveGalleryView({
  dreams,
  totalDreamCount,
  searchQuery,
  selectedTags,
  selectedArchetype,
  selectedMood,
  lucidOnly,
  tagCounts,
  onSearchChange,
  onToggleTag,
  onMoodChange,
  onToggleLucidOnly,
  onClearFilters,
  onOpenDream,
  onOpenCapture,
}: ArchiveGalleryViewProps) {
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const sortedDreams =
    sortOrder === "newest"
      ? dreams
      : [...dreams].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

  const hasFilters =
    searchQuery.trim().length > 0 ||
    selectedTags.length > 0 ||
    Boolean(selectedArchetype) ||
    Boolean(selectedMood) ||
    lucidOnly;

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-10">
      {/* Header & Search Controls */}
      <section className="space-y-6 border-b border-[#202430] pb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[#8A90A2]">
              Complete Nocturnal Catalogue
            </p>
            <h1 className="font-editorial text-4xl font-medium text-[#F2F0EB] sm:text-5xl">
              Dream Archive
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 sm:w-72">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6F7586]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search keyword, symbol, or #tag..."
                aria-label="Search dream archive"
                className="w-full rounded-lg border border-[#262B38] bg-[#12151E] py-2.5 pl-10 pr-9 text-sm text-[#F2F0EB] placeholder:text-[#666C7C] focus:border-[#D4A359]/70 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  aria-label="Clear search query"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#7C8292] hover:text-[#F2F0EB]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <select
              value={selectedMood ?? ""}
              onChange={(e) =>
                onMoodChange(
                  e.target.value ? (e.target.value as WakingMoodType) : null
                )
              }
              aria-label="Filter dreams by waking mood"
              className="h-[42px] rounded-lg border border-[#262B38] bg-[#12151E] px-3 text-xs font-medium text-[#D5D1C8] focus:border-[#D4A359]/70 focus:outline-none"
            >
              <option value="">All moods</option>
              {PREDEFINED_MOODS.map((m) => (
                <option key={m.id} value={m.id}>
                  Mood: {m.id}
                </option>
              ))}
            </select>

            <button
              type="button"
              aria-pressed={lucidOnly}
              onClick={onToggleLucidOnly}
              className={`inline-flex min-h-[42px] items-center rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                lucidOnly
                  ? "border-[#D4A359] bg-[#D4A359]/15 text-[#F2E0C1]"
                  : "border-[#262B38] bg-[#12151E] text-[#D5D1C8] hover:border-[#3A4154]"
              }`}
            >
              Lucid only
            </button>

            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))
              }
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#262B38] bg-[#12151E] px-3.5 py-2 text-xs font-medium text-[#D5D1C8] transition-colors hover:border-[#3A4154] whitespace-nowrap"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-[#8A90A2]" aria-hidden="true" />
              <span>{sortOrder === "newest" ? "Newest first" : "Oldest first"}</span>
            </button>
          </div>
        </div>

        {/* Tag Filter Ribbon */}
        {tagCounts.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#8A90A2]">
                Filter by tags ({selectedTags.length > 0 ? `${selectedTags.length} selected` : "select one or more"})
              </span>
              <div className="flex items-center gap-4 tabular-nums text-[#7C8292]">
                <span>
                  {sortedDreams.length} of {totalDreamCount} entries
                </span>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="font-medium text-[#D4A359] hover:text-[#E5BA76]"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {tagCounts.map(({ tag, count }) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onToggleTag(tag)}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors whitespace-nowrap ${
                      isSelected
                        ? "border-[#D4A359] bg-[#D4A359]/15 text-[#F2E0C1]"
                        : "border-[#232836] bg-[#12151E] text-[#9EA4B4] hover:border-[#363D52] hover:text-[#F2F0EB]"
                    }`}
                  >
                    <span>#{tag}</span>
                    <span className="font-mono text-[10px] tabular-nums opacity-70">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedArchetype && (
          <div className="inline-flex items-center gap-2 rounded-md border border-[#2D3342] bg-[#141720] px-3 py-1.5 text-xs text-[#D5D1C8]">
            <span>
              Filtering by archetype:{" "}
              <strong className="font-medium text-[#D4A359]">{selectedArchetype}</strong>
            </span>
            <button
              type="button"
              onClick={onClearFilters}
              aria-label="Clear archetype filter"
              className="text-[#8A90A2] hover:text-[#F2F0EB]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>

      {/* Gallery Grid */}
      {sortedDreams.length === 0 ? (
        <div className="rounded-xl border border-[#202430] bg-[#11131A] px-6 py-16 text-center space-y-4">
          <h2 className="font-editorial text-3xl text-[#F2F0EB]">
            {totalDreamCount === 0
              ? "Your dream archive is empty"
              : "No dreams match these criteria"}
          </h2>
          <p className="mx-auto max-w-md text-sm text-[#8E94A6]">
            {totalDreamCount === 0
              ? "Record your first voice dream upon waking to transcribe it, paint its surrealist theme, and uncover Jungian archetypes."
              : "Try removing a tag, mood, or lucidity filter, or broadening your search keywords."}
          </p>
          <div className="pt-2">
            {totalDreamCount === 0 ? (
              <button
                type="button"
                onClick={onOpenCapture}
                className="inline-flex min-h-[42px] items-center rounded-lg bg-[#D4A359] px-5 py-2 text-sm font-semibold text-[#0B0C10] hover:bg-[#DFB26E]"
              >
                Record First Dream
              </button>
            ) : (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex min-h-[40px] items-center rounded-lg border border-[#303647] px-4 py-2 text-xs font-medium text-[#F2F0EB] hover:border-[#D4A359]"
              >
                Reset Search & Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {sortedDreams.map((dream) => (
            <article
              key={dream.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-[#212532] bg-[#11141B] transition-colors hover:border-[#343B4E]"
            >
              <button
                type="button"
                onClick={() => onOpenDream(dream.id)}
                className="block aspect-video w-full overflow-hidden bg-[#0C0E14] text-left"
              >
                {dream.imageUrl ? (
                  <img
                    src={dream.imageUrl}
                    alt={`Surrealist painting for ${dream.title}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#141722] text-[#666C7C]">
                    <ImageIcon className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
              </button>

              <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums text-[#7C8292]">
                    <span>{String(dream.entryNumber).padStart(3, "0")}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {new Date(dream.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {dream.wakingMood && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {dream.wakingMood.mood} {dream.wakingMood.rating}/5
                        </span>
                      </>
                    )}
                    {dream.lucidity?.isLucid && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#D4A359]">Lucid</span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenDream(dream.id)}
                    className="block text-left"
                  >
                    <h2 className="font-editorial text-2xl font-medium leading-snug text-[#F2F0EB] transition-colors group-hover:text-[#E6C080]">
                      {dream.title}
                    </h2>
                  </button>

                  <p className="text-xs font-medium text-[#D4A359]">
                    {dream.coreEmotionalTheme}
                  </p>

                  <p className="line-clamp-2 text-xs leading-relaxed text-[#959BAC]">
                    {dream.summary}
                  </p>
                </div>

                <div className="border-t border-[#1D212D] pt-3 space-y-2">
                  {dream.archetypes.length > 0 && (
                    <p className="truncate text-[11px] text-[#8A90A2]">
                      {dream.archetypes.map((a) => a.name).join(" · ")}
                    </p>
                  )}
                  {dream.tags.length > 0 && (
                    <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-[#757B8E]">
                      {dream.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => onToggleTag(tag)}
                          className={`hover:text-[#D4A359] transition-colors ${
                            selectedTags.includes(tag) ? "text-[#D4A359] font-medium" : ""
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
