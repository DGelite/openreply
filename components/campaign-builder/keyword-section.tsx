import React from "react";
import { Section, Radio, Toggle } from "./ui-controls";
import type { MatchMode } from "./types";

interface KeywordSectionProps {
  matchMode: MatchMode;
  setMatchMode: (mode: MatchMode) => void;
  keywordText: string;
  setKeywordText: (val: string) => void;
  publicReplyEnabled: boolean;
  setPublicReplyEnabled: (enabled: boolean) => void;
  publicReplyMessages: string[];
  setPublicReplyMessages: React.Dispatch<React.SetStateAction<string[]>>;
}

export function KeywordSection({
  matchMode,
  setMatchMode,
  keywordText,
  setKeywordText,
  publicReplyEnabled,
  setPublicReplyEnabled,
  publicReplyMessages,
  setPublicReplyMessages,
}: KeywordSectionProps) {
  return (
    <Section title="And this comment has">
      <Radio
        checked={matchMode === "specific"}
        onSelect={() => setMatchMode("specific")}
      >
        a specific word or words
      </Radio>
      {matchMode === "specific" && (
        <div className="space-y-1">
          <input
            value={keywordText}
            onChange={(e) => setKeywordText(e.target.value)}
            placeholder="Enter a word or multiple"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
          />
          <p className="text-xs text-muted">Use commas to separate words</p>
        </div>
      )}
      <Radio
        checked={matchMode === "any"}
        onSelect={() => setMatchMode("any")}
      >
        any word
      </Radio>
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <span className="text-sm text-foreground">
          reply to their comments under the post
        </span>
        <Toggle
          on={publicReplyEnabled}
          onToggle={() => setPublicReplyEnabled(!publicReplyEnabled)}
        />
      </div>
      {publicReplyEnabled && (
        <div className="space-y-2">
          {publicReplyMessages.map((msg, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={msg}
                onChange={(e) =>
                  setPublicReplyMessages((prev) =>
                    prev.map((m, idx) => (idx === i ? e.target.value : m))
                  )
                }
                placeholder="Sent you a DM! 📩"
                maxLength={1000}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
              />
              {publicReplyMessages.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setPublicReplyMessages((prev) =>
                      prev.filter((_, idx) => idx !== i)
                    )
                  }
                  className="shrink-0 px-2 text-muted hover:text-error"
                  aria-label="Remove reply"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {publicReplyMessages.length < 10 && (
            <button
              type="button"
              onClick={() =>
                setPublicReplyMessages((prev) => [...prev, ""])
              }
              className="text-xs font-medium text-accent hover:underline"
            >
              + Add another reply
            </button>
          )}
          <p className="text-xs text-muted">
            One is picked at random each time, so replies don&apos;t look
            identical.
          </p>
        </div>
      )}
    </Section>
  );
}
