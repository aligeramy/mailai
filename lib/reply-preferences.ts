import type {
  ReplyLength,
  ReplyTone,
  ResolvedReplyPreferenceLevel,
  ResolvedReplyPreferences,
} from "@/lib/types";

export const REPLY_PREFERENCE_STORAGE_KEY = "mailai_reply_preferences";

export const RESOLVED_REPLY_PREFERENCE_LEVELS: ResolvedReplyPreferenceLevel[] =
  ["light", "normal", "high"];

export const REPLY_PREFERENCE_VALUES: ReplyLength[] = [
  "auto",
  ...RESOLVED_REPLY_PREFERENCE_LEVELS,
];

export const DEFAULT_RESOLVED_REPLY_PREFERENCES: ResolvedReplyPreferences = {
  tone: "normal",
  length: "normal",
};

export const REPLY_LENGTH_LABELS: Record<ReplyLength, string> = {
  auto: "Auto",
  light: "Light",
  normal: "Normal",
  high: "High",
};

export const REPLY_TONE_LABELS: Record<ReplyTone, string> = {
  auto: "Auto",
  light: "Light",
  normal: "Normal",
  high: "High",
};

export const REPLY_LENGTH_TITLES: Record<ReplyLength, string> = {
  auto: "Auto — AI picks the best length for this thread",
  light: "Light — a lean reply for simple asks",
  normal: "Normal — a balanced default",
  high: "High — fuller detail when the thread needs it",
};

export const REPLY_TONE_TITLES: Record<ReplyTone, string> = {
  auto: "Auto — AI picks the best tone strength for this thread",
  light: "Light — subtle tone shaping",
  normal: "Normal — clear, polished, natural",
  high: "High — stronger voice and warmth when needed",
};

export function isResolvedReplyPreferenceLevel(
  value: unknown
): value is ResolvedReplyPreferenceLevel {
  return value === "light" || value === "normal" || value === "high";
}

export function isReplyPreference(value: unknown): value is ReplyLength {
  return value === "auto" || isResolvedReplyPreferenceLevel(value);
}

export function resolveReplyPreferenceSelection(
  value: ReplyLength | ReplyTone,
  resolvedValue: ResolvedReplyPreferenceLevel | null | undefined,
  fallback: ResolvedReplyPreferenceLevel = "normal"
): ResolvedReplyPreferenceLevel {
  if (value === "auto") {
    return resolvedValue ?? fallback;
  }
  return value;
}
