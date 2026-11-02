# OpenReply Multi-Provider Capability Matrix: Meta Graph API vs. BoxAPI

> **Architectural Reference Document**  
> **Target System:** `I:\Desktop\openreply-main`  
> **Status:** APPROVED FOR IMPLEMENTATION

---

## 1. Feature-by-Feature Capability Comparison

| Operational Feature | Meta Graph API v25.0 (Direct) | BoxAPI Official API | BoxAPI Data API | OpenReply Orchestration Strategy |
| :--- | :---: | :---: | :---: | :--- |
| **Send Text Direct Message** | ✅ Yes | ✅ Yes (`/service/actions/send_message`) | ❌ No | Supported in Both. Seamless failover. |
| **Send Interactive Buttons** | ✅ Yes | ✅ Yes (Postback & Web_URL) | ❌ No | Identical button schema. |
| **Send Quick Replies** | ✅ Yes | ✅ Yes (`quick_replies: [{content_type, title, payload}]`) | ❌ No | Fully interchangeable. |
| **Generic Template Carousel**| ✅ Yes | ✅ Yes (`/service/actions/send_generic_template`) | ❌ No | 1-to-1 mapping in Flow Builder. |
| **Send Media / Attachments** | ✅ Yes | ✅ Yes (`/service/actions/send_attachment`, `send_image`) | ❌ No | BoxAPI supports direct URLs or CDN upload. |
| **Send Voice Audio** | ✅ Yes | ✅ Yes (`attachment_type: "voice"`) | ❌ No | Supported in Both. |
| **Public Comment Reply** | ✅ Yes | ✅ Yes (`/service/actions/reply_comment`) | ❌ No | Supported in Both. |
| **Private Reply to Comment** | ✅ Yes | ✅ Yes (`/service/actions/private_reply`) | ❌ No | Direct 1-to-1 equivalence. |
| **Delete Comment** | ✅ Yes | ✅ Yes (`/service/actions/delete_comment`) | ❌ No | Moderation node in Flow Builder. |
| **Hide / Unhide Comment** | ✅ Yes | ✅ Yes (`/service/actions/comment-show-hide`) | ❌ No | Moderation node in Flow Builder. |
| **Check Follower Status** | ⚠️ Restricted | ✅ Yes (`/service/actions/follow_status`) | ⚠️ Public only | BoxAPI provides dedicated endpoint without complex permissions! |
| **Persistent Menu** | ✅ Yes | ✅ Yes (`/service/actions/persistent-menu`) | ❌ No | Admin Account Settings. |
| **Ice Breakers (FAQ)** | ✅ Yes | ✅ Yes (`/service/actions/ice-breakers`) | ❌ No | Admin Account Settings. |
| **Webhook Delivery** | ✅ Yes | ✅ Yes (HMAC-SHA256 signature) | ❌ No | Dual Webhook Ingestion supported. |
| **Historical Comment Scan** | ⚠️ Strict Rate Limits | ⚠️ Page posts only | ✅ **YES** (`media/get_comments`) | **Data API used for Reconciliation Worker (Zero Lead Loss)** |
| **24-Hour Messaging Window** | 🔴 Enforced by Meta | 🔴 Enforced by Meta Gateway | N/A | Circuit breaker & policy guard applied uniformly. |
| **Rate Limits** | 4,800 calls / hour / account | Plan based (e.g. 100 req/min) | Credit/token quota | Dynamic Rate Limiter monitors both tiers. |
| **Account Auth Method** | Facebook OAuth User Token | API Key + Account UUID | Bearer Token | Managed in `InstagramAccount` table. |
| **Lead & CRM Integration** | Supported via Booking SDK | Supported via Booking SDK | Supported via Booking SDK | Completely Provider-Agnostic. |

---

## 2. Decision on Provider Roles in OpenReply Modes

### Mode A: `BOXAPI_PRIMARY`
* Outbound DMs, Comments, and Templates dispatch via BoxAPI.
* Inbound Webhooks received via BoxAPI Webhook endpoint (`/api/webhook/boxapi`).
* Zero Meta Access Token required for daily operations.
* Data API runs background reconciliation for missed comments.

### Mode B: `META_PRIMARY` + `BOXAPI_BACKUP`
* Meta Direct is default outbound channel.
* BoxAPI remains initialized in Standby / Hot Failover mode.
* When Meta returns `368 (PolicyBlock)`, `RateLimit`, `TokenExpired`, or network timeouts, the Provider Manager immediately redirects outbound dispatch to BoxAPI.

### Mode C: `SMART_HYBRID`
* Dispatches based on real-time circuit breaker health metrics, operational capabilities (e.g. follow-status check uses BoxAPI directly), and error backoffs.
