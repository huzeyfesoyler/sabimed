import { Search, X } from "lucide-react";
import type { DreamEntry } from "../types/dream";

interface DreamSidebarProps {
  dreams: DreamEntry[];
  totalDreamCount: number;
  activeDreamId: string | null;
  searchQuery: string;
  selectedTags: string[];
  selectedArchetype: string | null;
  lucidOnly: boolean;
  tagCounts: Array<{ tag: string; count: number }>;
  onSearchChange: (value: string) => void;
  onToggleTag: (tag: string) => void;
  onToggleLucidOnly: () => void;
  onClearFilters: () => void;
  onSelectDream: (id: string) => void;
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatShortTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function DreamSidebar({
  dreams,
  totalDreamCount,
  activeDreamId,
  searchQuery,
  selectedTags,
  selectedArchetype,
  lucidOnly,
  tagCounts,
  onSearchChange,
  onToggleTag,
  onToggleLucidOnly,
  onClearFilters,
  onSelectDream,
}: DreamSidebarProps) {
  const hasFilters =
    searchQuery.trim().length > 0 ||
    selectedTags.length > 0 ||
    Boolean(selectedArchetype) ||
    lucidOnly;

  return (
    <aside
      aria-label="Dream archive index"
      className="flex h-full flex-col border-r border-[#202430] bg-[#0D0F14]"
    >
      {/* Search & Tag Filter Controls */}
      <div className="space-y-4 border-b border-[#202430] p-4 sm:p-5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6F7586]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search keywords, mood, #tag..."
            aria-label="Search dreams by keyword, mood, or tag"
            className="w-full rounded-lg border border-[#252A38] bg-[#13161E] py-2.5 pl-9 pr-9 text-sm text-[#F2F0EB] placeholder:text-[#666C7C] transition-colors focus:border-[#D4A359]/70 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search text"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#7C8292] hover:text-[#F2F0EB]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Interactive Tag & Lucid Filter Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8A90A2]">
              Filter by tags
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-pressed={lucidOnly}
                onClick={onToggleLucidOnly}
                className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  lucidOnly
                    ? "border-[#D4A359] bg-[#D4A359]/15 text-[#F2E0C1]"
                    : "border-[#252A38] text-[#8E94A6] hover:border-[#363D52] hover:text-[#F2F0EB]"
                }`}
              >
                Lucid only
              </button>
              {hasFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="text-xs font-medium text-[#D4A359] transition-colors hover:text-[#E5BA76] whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {tagCounts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagCounts.slice(0, 14).map(({ tag, count }) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleTag(tag)}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors duration-150 whitespace-nowrap ${
                      isSelected
                        ? "border-[#D4A359] bg-[#D4A359]/15 text-[#F2E0C1]"
                        : "border-[#232836] bg-[#13161E] text-[#9EA4B4] hover:border-[#363D52] hover:text-[#E6E3DC]"
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
          )}
        </div>

        {selectedArchetype && (
          <div className="flex items-center justify-between rounded-md border border-[#2C3140] bg-[#141720] px-2.5 py-1.5 text-xs">
            <span className="text-[#C8C5BC] truncate">
              Archetype: <strong className="font-medium text-[#D4A359]">{selectedArchetype}</strong>
            </span>
            <button
              type="button"
              onClick={onClearFilters}
              aria-label="Clear archetype filter"
              className="ml-2 text-[#7C8292] hover:text-[#F2F0EB]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-[#7C8292] tabular-nums">
          <span>
            Showing {dreams.length} of {totalDreamCount} entries
          </span>
        </div>
      </div>

      {/* Archival Entry List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1C202B]">
        {dreams.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="font-editorial text-lg text-[#D5D1C8]">
              No matching dream entries
            </p>
            <p className="text-xs leading-relaxed text-[#7E8496]">
              Adjust your search terms or clear active filters to view the full archive.
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex min-h-[36px] items-center rounded-md border border-[#2E3444] px-3 py-1.5 text-xs font-medium text-[#E8E5DE] hover:border-[#D4A359]/60 hover:text-[#D4A359]"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          dreams.map((dream) => {
            const isActive = dream.id === activeDreamId;
            return (
              <button
                key={dream.id}
                type="button"
                onClick={() => onSelectDream(dream.id)}
                className={`block w-full px-5 py-4 text-left transition-colors duration-150 ${
                  isActive
                    ? "bg-[#151822]"
                    : "bg-transparent hover:bg-[#11141C]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] tabular-nums text-[#7C8292]">
                  <span>{String(dream.entryNumber).padStart(3, "0")}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatShortDate(dream.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatShortTime(dream.createdAt)}</span>
                  {dream.lucidity?.isLucid && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#D4A359]">Lucid</span>
                    </>
                  )}
                </div>

                <h3
                  className={`mt-1.5 font-editorial text-xl font-medium leading-snug transition-colors ${
                    isActive ? "text-[#E6C080]" : "text-[#F2F0EB]"
                  }`}
                >
                  {dream.title}
                </h3>

                <p className="mt-1 line-clamp-1 text-xs text-[#9197A8]">
                  {dream.wakingMood
                    ? `${dream.wakingMood.mood} (${dream.wakingMood.rating}/5) · ${dream.coreEmotionalTheme}`
                    : dream.coreEmotionalTheme}
                </p>

                {dream.tags.length > 0 && (
                  <p className="mt-2 truncate text-[11px] text-[#6E7487]">
                    {dream.tags.join(" · ")}
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
