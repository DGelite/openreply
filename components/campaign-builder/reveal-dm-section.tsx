import React from "react";
import { Section } from "./ui-controls";

interface RevealDmSectionProps {
  dmMessage: string;
  setDmMessage: (val: string) => void;
  linkOpen: boolean;
  setLinkOpen: (open: boolean) => void;
  trackedDestinationUrl: string;
  setTrackedDestinationUrl: (url: string) => void;
  linkButtonLabel: string;
  setLinkButtonLabel: (label: string) => void;
  ensureLinkToken: () => void;
}

export function RevealDmSection({
  dmMessage,
  setDmMessage,
  linkOpen,
  setLinkOpen,
  trackedDestinationUrl,
  setTrackedDestinationUrl,
  linkButtonLabel,
  setLinkButtonLabel,
  ensureLinkToken,
}: RevealDmSectionProps) {
  return (
    <Section title="And then, they will get">
      <div className="rounded-lg border border-border p-3 space-y-2">
        <span className="text-sm text-foreground">a DM with a link</span>
        <textarea
          value={dmMessage}
          onChange={(e) => setDmMessage(e.target.value)}
          placeholder="Write a message"
          rows={3}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none resize-none"
          maxLength={1000}
        />
        {linkOpen ? (
          <div className="space-y-2">
            <input
              value={trackedDestinationUrl}
              onChange={(e) => setTrackedDestinationUrl(e.target.value)}
              onBlur={ensureLinkToken}
              placeholder="https://yourlink.com/offer"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
            />
            <input
              value={linkButtonLabel}
              onChange={(e) => setLinkButtonLabel(e.target.value)}
              placeholder="Button label (e.g. Open link)"
              maxLength={20}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            className="w-full rounded-lg border border-border py-2 text-sm text-muted hover:text-foreground"
          >
            + Add A Link
          </button>
        )}
        <p className="text-xs text-muted">
          {"{link}"} inserts the tracked link; {"{username}"} personalizes.
        </p>
      </div>
    </Section>
  );
}
