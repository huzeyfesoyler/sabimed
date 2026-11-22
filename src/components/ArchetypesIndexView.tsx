import { ArrowRight } from "lucide-react";
import type { DreamEntry, WakingMoodType } from "../types/dream";

interface ArchetypesIndexViewProps {
  dreams: DreamEntry[];
  tagCounts: Array<{ tag: string; count: number }>;
  onSelectArchetype: (archetypeName: string) => void;
  onSelectTag: (tag: string) => void;
  onSelectMood: (mood: WakingMoodType) => void;
}

interface ArchetypeAggregate {
  name: string;
  count: number;
  latestMeaning: string;
  dreamTitles: string[];
}

export function ArchetypesIndexView({
  dreams,
  tagCounts,
  onSelectArchetype,
  onSelectTag,
  onSelectMood,
}: ArchetypesIndexViewProps) {
  const archetypeMap = new Map<string, ArchetypeAggregate>();

  for (const dream of dreams) {
    for (const arch of dream.archetypes) {
      const key = arch.name.trim().toLowerCase();
      const existing = archetypeMap.get(key);
      if (existing) {
        existing.count += 1;
        if (!existing.dreamTitles.includes(dream.title)) {
          existing.dreamTitles.push(dream.title);
        }
      } else {
        archetypeMap.set(key, {
          name: arch.name.trim(),
          count: 1,
          latestMeaning: arch.psychologicalMeaning,
          dreamTitles: [dream.title],
        });
      }
    }
  }

  const archetypes = Array.from(archetypeMap.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );

  // Waking mood analytics
  const moodTrackedDreams = dreams.filter((d) => Boolean(d.wakingMood));
  const avgMoodRating =
    moodTrackedDreams.length > 0
      ? (
          moodTrackedDreams.reduce(
            (sum, d) => sum + (d.wakingMood?.rating ?? 0),
            0
          ) / moodTrackedDreams.length
        ).toFixed(1)
      : null;

  const moodDistributionMap = new Map<
    WakingMoodType,
    { mood: WakingMoodType; count: number; totalRating: number }
  >();
  for (const d of moodTrackedDreams) {
    if (!d.wakingMood) continue;
    const prev = moodDistributionMap.get(d.wakingMood.mood);
    if (prev) {
      prev.count += 1;
      prev.totalRating += d.wakingMood.rating;
    } else {
      moodDistributionMap.set(d.wakingMood.mood, {
        mood: d.wakingMood.mood,
        count: 1,
        totalRating: d.wakingMood.rating,
      });
    }
  }
  const moodStats = Array.from(moodDistributionMap.values()).sort(
    (a, b) => b.count - a.count || b.totalRating - a.totalRating
  );

  const lucidCount = dreams.filter((d) => d.lucidity?.isLucid).length;
  const totalSymbols = dreams.reduce((acc, d) => acc + d.symbols.length, 0);

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-12">
      <header className="space-y-4 border-b border-[#202430] pb-8">
        <p className="text-xs font-medium text-[#8A90A2]">
          Jungian Pattern & Mood Lexicon
        </p>
        <h1 className="font-editorial text-4xl font-medium text-[#F2F0EB] sm:text-5xl">
          Recurring Archetypes & Waking Moods
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[#959BAC]">
          An analytical overview of the psychological figures, waking mood patterns, and thematic tags surfacing across your recorded dreams.
        </p>

        {/* Quiet unboxed summary metrics */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 font-mono text-xs tabular-nums text-[#8A90A2]">
          <span>{dreams.length} recorded dreams</span>
          <span aria-hidden="true">·</span>
          <span>{archetypes.length} distinct archetypes</span>
          <span aria-hidden="true">·</span>
          <span>{totalSymbols} catalogued symbols</span>
          <span aria-hidden="true">·</span>
          <span>{lucidCount} lucid entries</span>
          {avgMoodRating && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#D4A359]">
                Avg waking mood {avgMoodRating} / 5
              </span>
            </>
          )}
        </div>
      </header>

      {/* Waking Mood Analysis */}
      <section aria-labelledby="mood-analysis-heading" className="space-y-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2
            id="mood-analysis-heading"
            className="font-editorial text-3xl font-medium text-[#F2F0EB]"
          >
            Waking Mood Analysis
          </h2>
          <span className="font-mono text-xs tabular-nums text-[#7E8496]">
            {moodTrackedDreams.length} of {dreams.length} entries rated
          </span>
        </div>

        {moodStats.length === 0 ? (
          <p className="text-sm text-[#8E94A6]">
            Rate your waking mood after recording a dream (or inside any dream monograph) to see emotional patterns here.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {moodStats.map((stat) => {
              const avgForMood = (stat.totalRating / stat.count).toFixed(1);
              const pct = Math.round(
                (stat.count / moodTrackedDreams.length) * 100
              );
              return (
                <button
                  key={stat.mood}
                  type="button"
                  onClick={() => onSelectMood(stat.mood)}
                  className="flex flex-col justify-between space-y-4 rounded-xl border border-[#212532] bg-[#11141B] p-5 text-left transition-colors hover:border-[#D4A359]/60"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-editorial text-2xl font-medium text-[#F2F0EB]">
                      {stat.mood}
                    </h3>
                    <span className="font-mono text-xs tabular-nums text-[#D4A359]">
                      {avgForMood}/5 avg
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1C202C]">
                      <div
                        className="h-full rounded-full bg-[#D4A359]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-[#83899B]">
                      <span>
                        {stat.count} {stat.count === 1 ? "dream" : "dreams"} ({pct}%)
                      </span>
                      <span className="text-[#C8C5BC]">Filter →</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Archetype Index */}
      <section
        aria-labelledby="archetype-list-heading"
        className="space-y-5 border-t border-[#202430] pt-10"
      >
        <h2
          id="archetype-list-heading"
          className="font-editorial text-3xl font-medium text-[#F2F0EB]"
        >
          Archetypes Observed
        </h2>

        {archetypes.length === 0 ? (
          <p className="text-sm text-[#8E94A6]">
            Record your first dream to begin mapping recurring Jungian archetypes.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {archetypes.map((item, idx) => (
              <div
                key={item.name}
                className="flex flex-col justify-between space-y-4 rounded-xl border border-[#212532] bg-[#11141B] p-6"
              >
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono text-xs tabular-nums text-[#D4A359]">
                        {String(idx + 1).padStart(2, "0")}.
                      </span>
                      <h3 className="font-editorial text-2xl font-medium text-[#F2F0EB]">
                        {item.name}
                      </h3>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-[#7E8496]">
                      {item.count} {item.count === 1 ? "entry" : "entries"}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-[#9FA5B5]">
                    {item.latestMeaning}
                  </p>
                </div>

                <div className="space-y-3 border-t border-[#1D212D] pt-4">
                  <p className="truncate text-xs text-[#7E8496]">
                    Appears in: {item.dreamTitles.join(" · ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => onSelectArchetype(item.name)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-medium text-[#D4A359] transition-colors hover:text-[#E8BF7B]"
                  >
                    <span>View matching dreams</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tag Lexicon */}
      {tagCounts.length > 0 && (
        <section
          aria-labelledby="tag-lexicon-heading"
          className="space-y-5 border-t border-[#202430] pt-10"
        >
          <h2
            id="tag-lexicon-heading"
            className="font-editorial text-3xl font-medium text-[#F2F0EB]"
          >
            Tag Index
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {tagCounts.map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag(tag)}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#242936] bg-[#12151E] px-3.5 py-2 text-xs text-[#D5D1C8] transition-colors hover:border-[#D4A359]/70 hover:text-[#E6C080] whitespace-nowrap"
              >
                <span>#{tag}</span>
                <span className="font-mono text-[11px] tabular-nums text-[#7C8292]">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
