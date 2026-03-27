"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_RESOLVED_REPLY_PREFERENCES,
  isReplyPreference,
  REPLY_PREFERENCE_STORAGE_KEY,
  resolveReplyPreferenceSelection,
} from "@/lib/reply-preferences";
import type {
  EmailChain,
  ReplyLength,
  ReplyTone,
  ResolvedReplyPreferences,
} from "@/lib/types";

interface UseReplyPreferencesOptions {
  additionalContext?: string;
  apiKey?: string;
  emailChain: EmailChain | null;
  storageKey?: string;
}

interface StoredReplyPreferences {
  length: ReplyLength;
  tone: ReplyTone;
}

function parseStoredReplyPreferences(
  raw: string | null
): StoredReplyPreferences | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      length?: unknown;
      tone?: unknown;
    };
    if (isReplyPreference(parsed.length) && isReplyPreference(parsed.tone)) {
      return {
        length: parsed.length,
        tone: parsed.tone,
      };
    }
  } catch {
    /* ignore invalid persisted state */
  }

  return null;
}

export function useReplyPreferences({
  additionalContext,
  apiKey,
  emailChain,
  storageKey = REPLY_PREFERENCE_STORAGE_KEY,
}: UseReplyPreferencesOptions) {
  const [tone, setTone] = useState<ReplyTone>("auto");
  const [length, setLength] = useState<ReplyLength>("auto");
  const [resolvedPreferences, setResolvedPreferences] =
    useState<ResolvedReplyPreferences | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const inFlightKeyRef = useRef<string | null>(null);
  const inFlightPromiseRef = useRef<Promise<ResolvedReplyPreferences> | null>(
    null
  );
  const resolvedInputKeyRef = useRef<string | null>(null);

  const hasAutoPreference = tone === "auto" || length === "auto";
  const normalizedAdditionalContext = additionalContext?.trim() || "";
  const inputKey = useMemo(() => {
    if (!emailChain || emailChain.messages.length === 0) {
      return null;
    }

    return JSON.stringify({
      additionalContext: normalizedAdditionalContext,
      emailChain,
    });
  }, [emailChain, normalizedAdditionalContext]);

  useEffect(() => {
    try {
      const stored = parseStoredReplyPreferences(
        localStorage.getItem(storageKey)
      );
      if (!stored) {
        return;
      }
      setTone(stored.tone);
      setLength(stored.length);
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          tone,
          length,
        } satisfies StoredReplyPreferences)
      );
    } catch {
      /* storage unavailable */
    }
  }, [length, storageKey, tone]);

  const resolveNow =
    useCallback(async (): Promise<ResolvedReplyPreferences> => {
      if (!(inputKey && emailChain) || emailChain.messages.length === 0) {
        return DEFAULT_RESOLVED_REPLY_PREFERENCES;
      }

      if (
        resolvedPreferences &&
        resolvedInputKeyRef.current === inputKey &&
        !resolutionError
      ) {
        return resolvedPreferences;
      }

      if (inFlightPromiseRef.current && inFlightKeyRef.current === inputKey) {
        return inFlightPromiseRef.current;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsResolving(true);
      setResolutionError(null);

      const requestPromise = (async () => {
        const response = await fetch("/api/reply-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailChain,
            additionalContext: normalizedAdditionalContext || undefined,
            ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}),
          }),
        });

        const data = (await response.json()) as {
          error?: string;
          length?: ReplyLength;
          tone?: ReplyTone;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Could not resolve reply settings.");
        }

        if (!(isReplyPreference(data.length) && isReplyPreference(data.tone))) {
          throw new Error("Invalid reply setting recommendation.");
        }

        return {
          length:
            data.length === "auto"
              ? DEFAULT_RESOLVED_REPLY_PREFERENCES.length
              : data.length,
          tone:
            data.tone === "auto"
              ? DEFAULT_RESOLVED_REPLY_PREFERENCES.tone
              : data.tone,
        } satisfies ResolvedReplyPreferences;
      })();

      inFlightPromiseRef.current = requestPromise;
      inFlightKeyRef.current = inputKey;

      try {
        const next = await requestPromise;
        if (requestId === requestIdRef.current) {
          setResolvedPreferences(next);
          resolvedInputKeyRef.current = inputKey;
        }
        return next;
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setResolutionError(
            error instanceof Error
              ? error.message
              : "Could not resolve reply settings."
          );
        }
        throw error;
      } finally {
        if (requestId === requestIdRef.current) {
          setIsResolving(false);
        }
        if (inFlightPromiseRef.current === requestPromise) {
          inFlightPromiseRef.current = null;
          inFlightKeyRef.current = null;
        }
      }
    }, [
      apiKey,
      emailChain,
      inputKey,
      normalizedAdditionalContext,
      resolutionError,
      resolvedPreferences,
    ]);

  useEffect(() => {
    if (!hasAutoPreference) {
      setIsResolving(false);
      setResolutionError(null);
      return;
    }

    if (!inputKey) {
      setResolvedPreferences(null);
      resolvedInputKeyRef.current = null;
      return;
    }

    if (resolvedInputKeyRef.current !== inputKey) {
      setResolvedPreferences(null);
    }

    const timer = window.setTimeout(() => {
      void resolveNow().catch(() => {
        /* surfaced in state */
      });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [hasAutoPreference, inputKey, resolveNow]);

  const ensureResolvedPreferences = useCallback(async () => {
    const recommendation = hasAutoPreference
      ? await resolveNow().catch(() => DEFAULT_RESOLVED_REPLY_PREFERENCES)
      : DEFAULT_RESOLVED_REPLY_PREFERENCES;

    return {
      tone: resolveReplyPreferenceSelection(
        tone,
        recommendation.tone,
        DEFAULT_RESOLVED_REPLY_PREFERENCES.tone
      ),
      length: resolveReplyPreferenceSelection(
        length,
        recommendation.length,
        DEFAULT_RESOLVED_REPLY_PREFERENCES.length
      ),
    } satisfies ResolvedReplyPreferences;
  }, [hasAutoPreference, length, resolveNow, tone]);

  return {
    ensureResolvedPreferences,
    hasAutoPreference,
    isResolving,
    isResolvingLength: isResolving && length === "auto",
    isResolvingTone: isResolving && tone === "auto",
    length,
    resolutionError,
    resolvedLength:
      length === "auto" ? (resolvedPreferences?.length ?? null) : length,
    resolvedPreferences,
    resolvedTone: tone === "auto" ? (resolvedPreferences?.tone ?? null) : tone,
    setLength,
    setTone,
    tone,
  };
}
