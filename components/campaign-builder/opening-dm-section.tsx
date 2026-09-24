import React from "react";
import { Section, Toggle } from "./ui-controls";

interface OpeningDmSectionProps {
  openingDmEnabled: boolean;
  setOpeningDmEnabled: (enabled: boolean) => void;
  openingDmMessage: string;
  setOpeningDmMessage: (val: string) => void;
  openingDmButtonLabel: string;
  setOpeningDmButtonLabel: (val: string) => void;
}

export function OpeningDmSection({
  openingDmEnabled,
  setOpeningDmEnabled,
  openingDmMessage,
  setOpeningDmMessage,
  openingDmButtonLabel,
  setOpeningDmButtonLabel,
}: OpeningDmSectionProps) {
  return (
    <Section title="Opening DM & Follow Gate Prompt (پیام اولیه و درخواست فالو)">
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-foreground">Require Follow / Opening Prompt</span>
            <p className="text-xs text-muted mt-0.5">
              Send an initial interactive DM asking the user to follow your page before receiving the link button.
            </p>
          </div>
          <Toggle
            on={openingDmEnabled}
            onToggle={() => setOpeningDmEnabled(!openingDmEnabled)}
          />
        </div>
        {openingDmEnabled && (
          <div className="mt-3 space-y-2">
            <textarea
              value={openingDmMessage}
              onChange={(e) => setOpeningDmMessage(e.target.value)}
              placeholder="سلام! برای دریافت فایل/لینک، اول پیج ما رو فالو کن و بعد روی دکمه زیر کلیک کن 👇"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none resize-none"
              maxLength={1000}
            />
            <input
              value={openingDmButtonLabel}
              onChange={(e) => setOpeningDmButtonLabel(e.target.value)}
              placeholder="فالو کردم / دریافت لینک (Confirm & Get Link)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
              maxLength={64}
            />
          </div>
        )}
      </div>
    </Section>
  );
}
