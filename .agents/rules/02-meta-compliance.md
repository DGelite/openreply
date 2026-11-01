---
trigger: model_decision
description: "Meta Graph API v25.0 compliance rules, 24-hour messaging window, and anti-ban cooloff."
---

# Meta Graph API v25.0 Compliance Rules

> **Reference:** [`META_APP_REVIEW.md`](file:///I:/Desktop/openreply-main/META_APP_REVIEW.md)

1. **24-Hour Messaging Policy:** Never dispatch promotional messages past the 24-hour interaction window unless an approved Meta Message Tag is explicitly attached.
2. **Anti-Ban Policy (Code 368):** When receiving a policy block or throttle from Instagram, the BullMQ worker must pause outbound dispatches immediately and initiate an exponential backoff cooldown.
3. **Persian Keyword Normalization:** Always pass incoming comment texts through `persian-keyword-matcher.ts` to normalize zero-width non-joiners (`\u200C`) and Arabic letter variations.
