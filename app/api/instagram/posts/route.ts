import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { getAllUserMedia, getUserMedia } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import { BoxApiClient } from "@/lib/providers/boxapi/boxapi-client";

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );

  if (!account) {
    return NextResponse.json(
      {
        success: false,
        error: "Instagram account not connected. Please connect your account first.",
      },
      { status: 400 }
    );
  }

  try {
    // ── BoxAPI Provider Branch ──────────────────────────────────────────────
    if (account.primaryProvider === "BOXAPI" || account.orchestrationMode === "BOXAPI_PRIMARY") {
      const apiKey = account.boxApiKey || process.env.BOXAPI_API_KEY || "";
      const accountId = account.boxAccountId || process.env.BOXAPI_ACCOUNT_ID || account.instagramId;
      const baseUrl = account.boxApiBaseUrl || process.env.BOXAPI_BASE_URL || "https://api.sendbox.chat/api/v1";

      const client = new BoxApiClient({
        apiKey,
        accountId,
        baseUrl,
      });

      const loadAll = request.nextUrl.searchParams.get("all") === "true";
      const limitParam = request.nextUrl.searchParams.get("limit");
      const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 25;
      const limit = loadAll ? 50 : Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 25;

      interface BoxPostItem {
        id: string;
        media_type?: string;
        media_url?: string;
        permalink?: string;
        thumbnail_url?: string;
        caption?: string;
        timestamp?: string;
      }
      interface BoxActionLogEntry {
        event_id?: string;
        event_type?: string;
        account_id?: string;
        payload?: {
          success?: boolean;
          result?: { data?: BoxPostItem[] };
        };
      }

      let posts: unknown[] = [];
      try {
        // BoxAPI /service/actions/list_posts is async (202 Accepted) and writes results to /service/actions/logs
        const resp = await client.officialPost<{
          event_id?: string;
          items?: BoxPostItem[];
        } | BoxPostItem[]>("/service/actions/list_posts", {
          fields: ["id", "media_type", "media_url", "permalink", "thumbnail_url", "caption", "timestamp"],
          limit,
        });

        if (resp?.data && Array.isArray(resp.data)) {
          posts = resp.data;
        } else if (resp?.data && !Array.isArray(resp.data) && Array.isArray(resp.data.items)) {
          posts = resp.data.items;
        } else {
          const eventId = !Array.isArray(resp?.data) ? resp?.data?.event_id : undefined;

          const extractPostsFromLog = (log?: BoxActionLogEntry): BoxPostItem[] | null => {
            const arr = log?.payload?.result?.data;
            return Array.isArray(arr) ? arr : null;
          };

          // Poll BoxAPI action logs briefly for the async list_posts completion
          for (let attempt = 0; attempt < 8; attempt++) {
            await new Promise((r) => setTimeout(r, attempt === 0 ? 700 : 600));
            const logsResp = await client.officialGet<BoxActionLogEntry[]>("/service/actions/logs?limit=20").catch(() => null);
            const logs = Array.isArray(logsResp?.data) ? logsResp.data : [];

            if (eventId) {
              const exactLog = logs.find((l) => l.event_id === eventId);
              const extracted = extractPostsFromLog(exactLog);
              if (extracted) {
                posts = extracted;
                break;
              }
            } else if (logs.length > 0) {
              const recentLog = logs.find(
                (l) =>
                  l.event_type === "action.list_posts" &&
                  l.payload?.success &&
                  (!accountId || l.account_id === accountId)
              );
              const extracted = extractPostsFromLog(recentLog);
              if (extracted) {
                posts = extracted;
                break;
              }
            }
          }

          // Fallback: if exact event_id didn't settle in 5s, serve latest successful list_posts log for this account
          if (posts.length === 0) {
            const logsResp = await client.officialGet<BoxActionLogEntry[]>("/service/actions/logs?limit=20").catch(() => null);
            const logs = Array.isArray(logsResp?.data) ? logsResp.data : [];
            const fallbackLog = logs.find(
              (l) =>
                l.event_type === "action.list_posts" &&
                l.payload?.success &&
                (!accountId || l.account_id === accountId)
            );
            const extracted = extractPostsFromLog(fallbackLog);
            if (extracted) {
              posts = extracted;
            }
          }
        }
      } catch (boxErr) {
        console.warn("[Instagram Posts] BoxAPI list_posts notice:", boxErr);
      }

      return NextResponse.json({ success: true, data: posts });
    }

    // ── Meta Graph API Provider Branch ──────────────────────────────────────
    let posts: unknown[] = [];
    try {
      const accessToken = decryptToken(account.accessToken);

      // `all=true` paginates the full library (for the campaign post picker);
      // otherwise return a single recent page.
      const loadAll = request.nextUrl.searchParams.get("all") === "true";
      if (loadAll) {
        posts = await getAllUserMedia(accessToken, 300);
      } else {
        const limitParam = request.nextUrl.searchParams.get("limit");
        const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 25;
        const limit = Number.isFinite(parsedLimit)
          ? Math.min(Math.max(parsedLimit, 1), 50)
          : 25;
        posts = await getUserMedia(accessToken, limit);
      }
    } catch (metaErr) {
      console.warn("[Instagram Posts] Meta fetch notice (graceful empty return):", metaErr);
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({ success: true, data: posts });
  } catch (err) {
    console.error("[Instagram Posts] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Instagram posts" },
      { status: 500 }
    );
  }
}
