import type {
  DreamEntry,
  RealityCheckConfig,
  WakingMoodType,
} from "../types/dream";
import { SEED_DREAMS } from "../data/seedDreams";

const DB_NAME = "oneira_dream_journal_db";
const DB_VERSION = 1;
const STORE_NAME = "dreams";
const SEEDED_FLAG_KEY = "oneira_seeded_v1";
const FALLBACK_STORAGE_KEY = "oneira_dreams_fallback_v1";
const REALITY_CHECK_STORAGE_KEY = "oneira_reality_check_config_v1";

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const DEFAULT_REALITY_CHECK_CONFIG: RealityCheckConfig = {
  enabled: false,
  scheduleMode: "interval",
  intervalMinutes: 90,
  startTime: "08:30",
  endTime: "22:00",
  customTimes: ["09:30", "13:00", "17:00", "21:00"],
  promptText: "Look down at your hands and count each finger carefully. Pause and ask: am I dreaming right now?",
  soundEnabled: true,
  browserNotificationsEnabled: false,
  completedTodayDate: getTodayIsoDate(),
  completedTodayCount: 0,
};

export function loadRealityCheckConfig(): RealityCheckConfig {
  try {
    const raw = localStorage.getItem(REALITY_CHECK_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_REALITY_CHECK_CONFIG, completedTodayDate: getTodayIsoDate() };
    const parsed = JSON.parse(raw) as Partial<RealityCheckConfig>;
    const today = getTodayIsoDate();
    const isSameDay = parsed.completedTodayDate === today;
    return {
      ...DEFAULT_REALITY_CHECK_CONFIG,
      ...parsed,
      customTimes:
        Array.isArray(parsed.customTimes) && parsed.customTimes.length > 0
          ? parsed.customTimes
          : DEFAULT_REALITY_CHECK_CONFIG.customTimes,
      completedTodayDate: today,
      completedTodayCount: isSameDay ? Number(parsed.completedTodayCount ?? 0) : 0,
    };
  } catch {
    return { ...DEFAULT_REALITY_CHECK_CONFIG, completedTodayDate: getTodayIsoDate() };
  }
}

export function saveRealityCheckConfig(config: RealityCheckConfig): void {
  try {
    localStorage.setItem(REALITY_CHECK_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function sortDreamsDesc(dreams: DreamEntry[]): DreamEntry[] {
  return [...dreams].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// Backfill wakingMood and lucidity onto initial seed entries if user loaded an earlier schema
function backfillSeedFields(entries: DreamEntry[]): { entries: DreamEntry[]; changed: boolean } {
  const seedMap = new Map(SEED_DREAMS.map((s) => [s.id, s]));
  let changed = false;
  const updated = entries.map((entry) => {
    const seed = seedMap.get(entry.id);
    if (!seed) return entry;
    let next = entry;
    if (!entry.wakingMood && seed.wakingMood) {
      next = { ...next, wakingMood: seed.wakingMood };
      changed = true;
    }
    if (!entry.lucidity && seed.lucidity) {
      next = { ...next, lucidity: seed.lucidity };
      changed = true;
    }
    return next;
  });
  return { entries: updated, changed };
}

export async function loadAllDreams(): Promise<DreamEntry[]> {
  try {
    const db = await openDatabase();
    const existing = await new Promise<DreamEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as DreamEntry[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    if (existing.length === 0 && !localStorage.getItem(SEEDED_FLAG_KEY)) {
      await saveAllDreams(SEED_DREAMS);
      localStorage.setItem(SEEDED_FLAG_KEY, "true");
      return sortDreamsDesc(SEED_DREAMS);
    }

    const { entries, changed } = backfillSeedFields(existing);
    if (changed) {
      await saveAllDreams(entries);
    }

    return sortDreamsDesc(entries);
  } catch {
    try {
      const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DreamEntry[];
        const { entries, changed } = backfillSeedFields(parsed);
        if (changed) {
          localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(entries));
        }
        return sortDreamsDesc(entries);
      }
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(SEED_DREAMS));
      localStorage.setItem(SEEDED_FLAG_KEY, "true");
      return sortDreamsDesc(SEED_DREAMS);
    } catch {
      return sortDreamsDesc(SEED_DREAMS);
    }
  }
}

export async function saveDream(entry: DreamEntry): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      const current = await loadAllDreams();
      const updated = [entry, ...current.filter((d) => d.id !== entry.id)];
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors in fallback mode
    }
  }
}

export async function saveAllDreams(entries: DreamEntry[]): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const entry of entries) {
        store.put(entry);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore storage quota errors in fallback mode
    }
  }
}

export async function deleteDreamById(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      const current = await loadAllDreams();
      const updated = current.filter((d) => d.id !== id);
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore fallback errors
    }
  }
}

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

export function extractTagCounts(dreams: DreamEntry[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const dream of dreams) {
    for (const tag of dream.tags) {
      const clean = normalizeTag(tag);
      if (clean) {
        counts.set(clean, (counts.get(clean) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function searchAndFilterDreams(
  dreams: DreamEntry[],
  keywordQuery: string,
  selectedTags: string[],
  selectedArchetype?: string | null,
  selectedMood?: WakingMoodType | null,
  lucidOnly?: boolean
): DreamEntry[] {
  const normalizedSelectedTags = selectedTags.map(normalizeTag).filter(Boolean);
  const terms = keywordQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return dreams.filter((dream) => {
    const dreamTagsNormalized = dream.tags.map(normalizeTag);

    if (
      normalizedSelectedTags.length > 0 &&
      !normalizedSelectedTags.every((t) => dreamTagsNormalized.includes(t))
    ) {
      return false;
    }

    if (
      selectedArchetype &&
      !dream.archetypes.some(
        (arch) => arch.name.toLowerCase() === selectedArchetype.toLowerCase()
      )
    ) {
      return false;
    }

    if (selectedMood && dream.wakingMood?.mood !== selectedMood) {
      return false;
    }

    if (lucidOnly && !dream.lucidity?.isLucid) {
      return false;
    }

    if (terms.length === 0) {
      return true;
    }

    const searchableHaystack = [
      dream.title,
      dream.transcript,
      dream.coreEmotionalTheme,
      dream.summary,
      ...dream.emotionalTone,
      ...dream.tags,
      dream.wakingMood?.mood ?? "",
      dream.wakingMood?.note ?? "",
      dream.lucidity?.isLucid ? "lucid" : "",
      dream.lucidity?.trigger ?? "",
      dream.lucidity?.experienceNotes ?? "",
      ...(dream.lucidity?.intentions.map((i) => i.text) ?? []),
      ...dream.archetypes.flatMap((a) => [a.name, a.manifestation, a.psychologicalMeaning]),
      ...dream.symbols.flatMap((s) => [s.symbol, s.context, s.meaning]),
    ]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => {
      if (term.startsWith("#") && term.length > 1) {
        const tagTerm = term.slice(1);
        return dreamTagsNormalized.some((t) => t.includes(tagTerm));
      }
      return searchableHaystack.includes(term);
    });
  });
}
