import { Mic } from "lucide-react";
import type { AppView } from "../types/dream";

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenCapture: () => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: "journal", label: "Journal" },
  { id: "archive", label: "Archive" },
  { id: "lucidity", label: "Lucidity" },
  { id: "archetypes", label: "Archetypes" },
];

export function TopBar({ activeView, onNavigate, onOpenCapture }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-[#202430] bg-[#0B0C10]/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate("journal")}
          className="font-editorial text-2xl font-medium tracking-tight text-[#F2F0EB] transition-opacity duration-150 hover:opacity-85 whitespace-nowrap shrink-0"
        >
          Oneira
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-5 sm:gap-8 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-2 transition-colors duration-150 whitespace-nowrap shrink-0 ${
                  isActive
                    ? "text-[#F2F0EB]"
                    : "text-[#8D93A5] hover:text-[#E2DFD7]"
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[1.5px] bg-[#D4A359]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenCapture}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#D4A359] px-4 py-2 text-sm font-semibold text-[#0B0C10] transition-colors duration-150 hover:bg-[#DFB26E] active:bg-[#C6944A] whitespace-nowrap shrink-0"
          >
            <Mic className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Record Dream</span>
          </button>
        </div>
      </div>
    </header>
  );
}
