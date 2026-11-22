import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import type {
  LucidAwarenessLevel,
  LucidDreamData,
  LucidInductionTechnique,
} from "../types/dream";

interface LucidDetailsEditorProps {
  value: LucidDreamData;
  onChange: (next: LucidDreamData) => void;
}

const AWARENESS_LEVELS: LucidAwarenessLevel[] = [
  "Semi-Lucid",
  "Lucid",
  "Full Control",
];

const TECHNIQUES: LucidInductionTechnique[] = [
  "Spontaneous",
  "Reality Check",
  "MILD",
  "WBTB",
  "WILD",
  "SSILD",
];

export function createEmptyLucidData(isLucid = true): LucidDreamData {
  return {
    isLucid,
    awarenessLevel: "Lucid",
    inductionTechnique: "Reality Check",
    trigger: "",
    experienceNotes: "",
    intentions: [],
  };
}

export function LucidDetailsEditor({ value, onChange }: LucidDetailsEditorProps) {
  const [newIntention, setNewIntention] = useState("");

  const addIntention = () => {
    const trimmed = newIntention.trim();
    if (!trimmed) return;
    onChange({
      ...value,
      intentions: [
        ...value.intentions,
        {
          id: `intent-${Date.now()}`,
          text: trimmed,
          achieved: false,
        },
      ],
    });
    setNewIntention("");
  };

  const toggleIntention = (id: string) => {
    onChange({
      ...value,
      intentions: value.intentions.map((item) =>
        item.id === id ? { ...item, achieved: !item.achieved } : item
      ),
    });
  };

  const removeIntention = (id: string) => {
    onChange({
      ...value,
      intentions: value.intentions.filter((item) => item.id !== id),
    });
  };

  return (
    <div className="space-y-5">
      {/* Awareness Level & Induction Technique */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="block text-xs font-medium text-[#959BAC]">
            Lucid Awareness Level
          </span>
          <div
            role="radiogroup"
            aria-label="Lucid awareness level"
            className="inline-flex w-full rounded-lg border border-[#242936] bg-[#0F1118] p-1"
          >
            {AWARENESS_LEVELS.map((level) => {
              const active = value.awarenessLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange({ ...value, awarenessLevel: level })}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? "bg-[#232837] text-[#E6C080]"
                      : "text-[#8A90A2] hover:text-[#DFDCD4]"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="lucid-technique-select"
            className="block text-xs font-medium text-[#959BAC]"
          >
            Induction Method
          </label>
          <select
            id="lucid-technique-select"
            value={value.inductionTechnique}
            onChange={(e) =>
              onChange({
                ...value,
                inductionTechnique: e.target.value as LucidInductionTechnique,
              })
            }
            className="h-[38px] w-full rounded-lg border border-[#242936] bg-[#13161F] px-3 text-xs text-[#F2F0EB] focus:border-[#D4A359]/70 focus:outline-none"
          >
            {TECHNIQUES.map((tech) => (
              <option key={tech} value={tech}>
                {tech}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Trigger */}
      <div className="space-y-1.5">
        <label
          htmlFor="lucid-trigger-input"
          className="block text-xs font-medium text-[#959BAC]"
        >
          What triggered lucidity?
        </label>
        <input
          id="lucid-trigger-input"
          type="text"
          value={value.trigger}
          onChange={(e) => onChange({ ...value, trigger: e.target.value })}
          placeholder="e.g., Counted fingers during a reality check, noticed impossible text, or recognized a recurring dream sign..."
          className="w-full rounded-lg border border-[#242936] bg-[#13161F] px-3.5 py-2.5 text-xs text-[#F2F0EB] placeholder:text-[#63697B] focus:border-[#D4A359]/70 focus:outline-none"
        />
      </div>

      {/* Dream Intentions */}
      <div className="space-y-2.5">
        <span className="block text-xs font-medium text-[#959BAC]">
          Dream Intentions (add goals you held or attempted while lucid)
        </span>

        {value.intentions.length > 0 && (
          <ul className="space-y-2">
            {value.intentions.map((intent) => (
              <li
                key={intent.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#222634] bg-[#13161F] px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => toggleIntention(intent.id)}
                  className="flex flex-1 items-center gap-2.5 text-left text-xs"
                >
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      intent.achieved
                        ? "border-[#D4A359] bg-[#D4A359] text-[#0B0C10]"
                        : "border-[#3A4154] bg-transparent"
                    }`}
                  >
                    {intent.achieved && <Check className="h-3 w-3" aria-hidden="true" />}
                  </span>
                  <span
                    className={
                      intent.achieved ? "text-[#F2F0EB]" : "text-[#B8BCC8]"
                    }
                  >
                    {intent.text}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-[#7E8496] whitespace-nowrap">
                    {intent.achieved ? "Achieved" : "Attempted"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeIntention(intent.id)}
                  aria-label={`Remove intention: ${intent.text}`}
                  className="rounded p-1 text-[#7C8292] hover:bg-[#212534] hover:text-[#F2F0EB]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newIntention}
            onChange={(e) => setNewIntention(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addIntention();
              }
            }}
            placeholder="Add a lucid intention (e.g., Ask a dream figure a question, stabilize scene)..."
            aria-label="New lucid dream intention"
            className="flex-1 rounded-lg border border-[#242936] bg-[#13161F] px-3.5 py-2 text-xs text-[#F2F0EB] placeholder:text-[#63697B] focus:border-[#D4A359]/70 focus:outline-none"
          />
          <button
            type="button"
            onClick={addIntention}
            disabled={!newIntention.trim()}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#303647] bg-[#171B26] px-3 py-1.5 text-xs font-medium text-[#E8E5DE] hover:border-[#D4A359]/70 hover:text-[#E6C080] disabled:opacity-40 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Lucid Experience Notes */}
      <div className="space-y-1.5">
        <label
          htmlFor="lucid-experience-notes"
          className="block text-xs font-medium text-[#959BAC]"
        >
          Lucid Experience & Stabilization Notes
        </label>
        <textarea
          id="lucid-experience-notes"
          rows={3}
          value={value.experienceNotes}
          onChange={(e) =>
            onChange({ ...value, experienceNotes: e.target.value })
          }
          placeholder="Describe what happened after becoming lucid—how you stabilized the dream, sensory clarity, or how the dream responded to your choices..."
          className="w-full rounded-lg border border-[#242936] bg-[#13161F] px-3.5 py-2.5 text-xs leading-relaxed text-[#F2F0EB] placeholder:text-[#63697B] focus:border-[#D4A359]/70 focus:outline-none"
        />
      </div>
    </div>
  );
}
