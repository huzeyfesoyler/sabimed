export type ImageResolution = "1K" | "2K" | "4K";
export type ImageAspectRatio = "16:9" | "4:3" | "1:1" | "3:4";

export type ChatModelId =
  | "gemini-4-hydrogen"
  | "gemini-4-carbon"
  | "gemini-4-neon"
  | "gemini-3.1-flash-lite";

export type WakingMoodType =
  | "Calm"
  | "Happy"
  | "Anxious"
  | "Confused"
  | "Awestruck"
  | "Melancholic"
  | "Restless"
  | "Inspired";

export const PREDEFINED_MOODS: Array<{
  id: WakingMoodType;
  description: string;
}> = [
  { id: "Calm", description: "Grounded, quiet, and settled" },
  { id: "Happy", description: "Light, uplifted, or warm" },
  { id: "Anxious", description: "Tense, uneasy, or alert" },
  { id: "Confused", description: "Disoriented or searching for clarity" },
  { id: "Awestruck", description: "Moved by vivid wonder or scale" },
  { id: "Melancholic", description: "Wistful, tender, or reflective" },
  { id: "Restless", description: "Agitated or unfinished energy" },
  { id: "Inspired", description: "Energized with creative insight" },
];

export interface WakingMoodData {
  mood: WakingMoodType;
  rating: number; // 1 to 5 waking mood rating
  note?: string;
  recordedAt: string;
}

export type LucidAwarenessLevel = "Semi-Lucid" | "Lucid" | "Full Control";

export type LucidInductionTechnique =
  | "Spontaneous"
  | "Reality Check"
  | "MILD"
  | "WBTB"
  | "WILD"
  | "SSILD";

export interface LucidIntention {
  id: string;
  text: string;
  achieved: boolean;
}

export interface LucidDreamData {
  isLucid: boolean;
  awarenessLevel: LucidAwarenessLevel;
  inductionTechnique: LucidInductionTechnique;
  trigger: string;
  experienceNotes: string;
  intentions: LucidIntention[];
}

export interface RealityCheckConfig {
  enabled: boolean;
  scheduleMode: "interval" | "times";
  intervalMinutes: number;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  customTimes: string[]; // array of HH:MM
  promptText: string;
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  completedTodayDate: string; // YYYY-MM-DD
  completedTodayCount: number;
  lastTriggeredAt?: string;
}

export interface DreamArchetype {
  name: string;
  manifestation: string;
  psychologicalMeaning: string;
  integrationPrompt: string;
}

export interface DreamSymbol {
  symbol: string;
  context: string;
  meaning: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: string;
  modelUsed?: ChatModelId;
}

export interface DreamInterpretationResponse {
  title: string;
  coreEmotionalTheme: string;
  emotionalTone: string[];
  summary: string;
  imagePrompt: string;
  archetypes: DreamArchetype[];
  symbols: DreamSymbol[];
  suggestedTags: string[];
}

export interface DreamEntry {
  id: string;
  entryNumber: number;
  createdAt: string;
  recordedDurationSec?: number;
  title: string;
  transcript: string;
  coreEmotionalTheme: string;
  emotionalTone: string[];
  summary: string;
  imagePrompt: string;
  imageUrl: string | null;
  imageResolution: ImageResolution;
  imageAspectRatio: ImageAspectRatio;
  archetypes: DreamArchetype[];
  symbols: DreamSymbol[];
  tags: string[];
  wakingMood?: WakingMoodData;
  lucidity?: LucidDreamData;
  chatHistory: ChatMessage[];
}

export type AppView = "journal" | "archive" | "lucidity" | "archetypes";
