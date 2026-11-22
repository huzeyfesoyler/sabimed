import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { normalizeTag } from "../services/dreamStorage";

interface TagManagerProps {
  tags: string[];
  allJournalTags: string[];
  onChangeTags: (nextTags: string[]) => void;
  onTagClick?: (tag: string) => void;
  compact?: boolean;
  label?: string;
}

export function TagManager({
  tags,
  allJournalTags,
  onChangeTags,
  onTagClick,
  compact = false,
  label = "Tags",
}: TagManagerProps) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalizedCurrent = tags.map(normalizeTag);

  const addTagsFromString = (rawInput: string) => {
    const pieces = rawInput
      .split(",")
      .map(normalizeTag)
      .filter(Boolean);
    if (pieces.length === 0) return;

    const merged = [...tags];
    for (const piece of pieces) {
      if (!merged.map(normalizeTag).includes(piece)) {
        merged.push(piece);
      }
    }
    onChangeTags(merged);
    setInputValue("");
  };

  const removeTag = (tagToRemove: string) => {
    const target = normalizeTag(tagToRemove);
    onChangeTags(tags.filter((t) => normalizeTag(t) !== target));
  };

  const suggestions = allJournalTags
    .map(normalizeTag)
    .filter((candidate) => {
      if (!candidate || normalizedCurrent.includes(candidate)) return false;
      if (!inputValue.trim()) return true;
      return candidate.includes(normalizeTag(inputValue));
    })
    .slice(0, 6);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {!compact && (
          <span className="text-xs font-medium text-[#7C8292] mr-1">
            {label}
          </span>
        )}

        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md border border-[#282D3B] bg-[#141720] text-xs text-[#DDD9D0] transition-colors duration-150 hover:border-[#3A4154]"
          >
            {onTagClick ? (
              <button
                type="button"
                onClick={() => onTagClick(tag)}
                title={`Filter archive by tag "${tag}"`}
                className="px-2.5 py-1.5 text-left hover:text-[#D4A359] transition-colors whitespace-nowrap"
              >
                #{tag}
              </button>
            ) : (
              <span className="pl-2.5 pr-1 py-1.5 whitespace-nowrap">#{tag}</span>
            )}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded text-[#7C8292] transition-colors hover:bg-[#222736] hover:text-[#F2F0EB]"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}

        <div className="relative inline-flex items-center">
          <div className="inline-flex items-center rounded-md border border-dashed border-[#2C3140] bg-[#0F1118] px-2 transition-colors focus-within:border-[#D4A359]/70">
            <Plus className="h-3.5 w-3.5 text-[#7C8292] shrink-0" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 160)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTagsFromString(inputValue);
                } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
                  removeTag(tags[tags.length - 1]);
                }
              }}
              placeholder="Add tag..."
              aria-label="Add a dream tag"
              className="w-28 bg-transparent px-1.5 py-1.5 text-xs text-[#F2F0EB] placeholder:text-[#666C7C] focus:outline-none sm:w-32"
            />
            {inputValue.trim().length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTagsFromString(inputValue)}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-[#D4A359] hover:bg-[#D4A359]/10 whitespace-nowrap"
              >
                Add
              </button>
            )}
          </div>

          {isFocused && suggestions.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[200px] rounded-lg border border-[#262B38] bg-[#13161F] p-1.5 shadow-xl">
              <p className="px-2 py-1 text-[11px] text-[#7C8292]">
                Existing journal tags
              </p>
              <div className="flex flex-wrap gap-1 px-1 pb-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      addTagsFromString(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="rounded border border-[#252A38] bg-[#191D28] px-2 py-1 text-xs text-[#CFCBC2] transition-colors hover:border-[#D4A359]/60 hover:text-[#D4A359] whitespace-nowrap"
                  >
                    #{suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
