import React from "react";
import PostPicker from "@/components/post-picker";
import { Section, Radio } from "./ui-controls";
import type { TriggerScope } from "./types";

interface TriggerSectionProps {
  triggerScope: TriggerScope;
  setTriggerScope: (scope: TriggerScope) => void;
  postId: string | null;
  selectedAccountId: string;
  usedPosts: Record<string, string>;
  handlePostSelect: (
    postId: string,
    postUrl?: string,
    thumbUrl?: string,
    caption?: string
  ) => void;
}

export function TriggerSection({
  triggerScope,
  setTriggerScope,
  postId,
  selectedAccountId,
  usedPosts,
  handlePostSelect,
}: TriggerSectionProps) {
  return (
    <Section title="When someone comments on">
      <Radio
        checked={triggerScope === "specific"}
        onSelect={() => setTriggerScope("specific")}
      >
        a specific post or reel
      </Radio>
      {triggerScope === "specific" && (
        <div className="rounded-lg border border-border p-2">
          <PostPicker
            selectedPostId={postId}
            instagramAccountId={selectedAccountId}
            usedPostIds={usedPosts}
            onSelect={handlePostSelect}
          />
        </div>
      )}
      <Radio
        checked={triggerScope === "any"}
        onSelect={() => setTriggerScope("any")}
      >
        any post or reel
      </Radio>
      <Radio
        checked={triggerScope === "next"}
        onSelect={() => setTriggerScope("next")}
      >
        next post or reel
      </Radio>
    </Section>
  );
}
