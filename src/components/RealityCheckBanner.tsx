import { Bell, Check, X } from "lucide-react";

interface RealityCheckBannerProps {
  promptText: string;
  completedTodayCount: number;
  onComplete: () => void;
  onDismiss: () => void;
}

export function RealityCheckBanner({
  promptText,
  completedTodayCount,
  onComplete,
  onDismiss,
}: RealityCheckBannerProps) {
  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-md rounded-xl border border-[#D4A359]/60 bg-[#13161F]/95 p-5 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[#D4A359]">
          <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Reality Check Reminder</span>
          <span aria-hidden="true" className="text-[#4B5163]">
            ·
          </span>
          <span className="font-mono tabular-nums text-[#8E94A6]">
            {completedTodayCount} logged today
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss reality check reminder"
          className="rounded p-1 text-[#7C8292] hover:bg-[#1E2230] hover:text-[#F2F0EB]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-3 font-editorial text-xl leading-snug text-[#F6F4EF]">
        {promptText}
      </p>

      <div className="mt-4 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onComplete}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#D4A359] px-3.5 py-2 text-xs font-semibold text-[#0B0C10] transition-colors hover:bg-[#DFB26E] whitespace-nowrap"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>I Checked — Log Reality Check</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex min-h-[38px] items-center rounded-lg border border-[#282D3B] px-3 py-2 text-xs text-[#9EA4B4] hover:text-[#F2F0EB] whitespace-nowrap"
        >
          Snooze
        </button>
      </div>
    </aside>
  );
}
