import { PREDEFINED_MOODS, type WakingMoodData, type WakingMoodType } from "../types/dream";

interface MoodCheckInEditorProps {
  value: WakingMoodData | null;
  onChange: (next: WakingMoodData) => void;
  compact?: boolean;
}

const RATING_LABELS: Record<number, string> = {
  1: "Heavy",
  2: "Uneasy",
  3: "Neutral",
  4: "Clear",
  5: "Radiant",
};

export function MoodCheckInEditor({
  value,
  onChange,
  compact = false,
}: MoodCheckInEditorProps) {
  const currentMood: WakingMoodType = value?.mood ?? "Calm";
  const currentRating: number = value?.rating ?? 3;
  const currentNote: string = value?.note ?? "";

  const update = (patch: Partial<WakingMoodData>) => {
    onChange({
      mood: patch.mood ?? currentMood,
      rating: patch.rating ?? currentRating,
      note: patch.note !== undefined ? patch.note : currentNote,
      recordedAt: value?.recordedAt ?? new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-5">
      {/* Predefined Mood Selection */}
      <div className="space-y-2.5">
        <span className="block text-xs font-medium text-[#959BAC]">
          How do you feel upon waking?
        </span>
        <div
          role="radiogroup"
          aria-label="Current waking mood"
          className={`grid gap-2 ${
            compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4"
          }`}
        >
          {PREDEFINED_MOODS.map((item) => {
            const isSelected = value?.mood === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => update({ mood: item.id })}
                className={`flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 ${
                  isSelected
                    ? "border-[#D4A359] bg-[#D4A359]/12 text-[#F6F4EF]"
                    : "border-[#242936] bg-[#13161F] text-[#B8BCC8] hover:border-[#363D52] hover:text-[#F2F0EB]"
                }`}
              >
                <span className="text-xs font-semibold">{item.id}</span>
                {!compact && (
                  <span className="mt-0.5 text-[11px] leading-snug text-[#7E8496]">
                    {item.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Waking Mood Rating (1 to 5) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#959BAC]">
            Rate your overall mood upon waking
          </span>
          <span className="font-mono text-xs tabular-nums text-[#D4A359]">
            {value ? `${currentRating} / 5 · ${RATING_LABELS[currentRating]}` : "Select 1–5"}
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Waking mood rating from 1 to 5"
          className="grid grid-cols-5 gap-2"
        >
          {[1, 2, 3, 4, 5].map((score) => {
            const isSelected = value?.rating === score;
            return (
              <button
                key={score}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => update({ rating: score })}
                className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border px-2 py-2 transition-colors duration-150 ${
                  isSelected
                    ? "border-[#D4A359] bg-[#D4A359]/15 text-[#F2E0C1]"
                    : "border-[#242936] bg-[#13161F] text-[#9EA4B4] hover:border-[#363D52] hover:text-[#F2F0EB]"
                }`}
              >
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {score}
                </span>
                <span className="mt-0.5 text-[10px] opacity-80">
                  {RATING_LABELS[score]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional Waking Reflection Note */}
      <div className="space-y-1.5">
        <label
          htmlFor="waking-mood-note"
          className="block text-xs font-medium text-[#959BAC]"
        >
          Waking mood note (optional)
        </label>
        <input
          id="waking-mood-note"
          type="text"
          value={currentNote}
          onChange={(e) => update({ note: e.target.value })}
          placeholder="Brief note on the lingering feeling or physical sensation upon waking..."
          className="w-full rounded-lg border border-[#242936] bg-[#13161F] px-3.5 py-2.5 text-xs text-[#F2F0EB] placeholder:text-[#63697B] focus:border-[#D4A359]/70 focus:outline-none"
        />
      </div>
    </div>
  );
}
