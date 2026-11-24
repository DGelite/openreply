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
    if (account.primaryProvider === "BOXAPI") {
      const apiKey = account.boxApiKey || process.env.BOXAPI_API_KEY || "";
      const accountId = account.boxAccountId || process.env.BOXAPI_ACCOUNT_ID || account.instagramId;
      const baseUrl = account.boxApiBaseUrl || process.env.BOXAPI_BASE_URL || "https://api.sendbox.chat/api/v1";

      const client = new BoxApiClient({
        apiKey,
        accountId,
        baseUrl,
      });

      let posts: any[] = [];
      try {
        const resp = await client.officialPost<any>("/service/actions/list_posts", {
          fields: ["id", "media_type", "media_url", "permalink", "caption", "timestamp"],
          limit: 25,
        });
        if (resp?.data && Array.isArray(resp.data)) {
          posts = resp.data;
        } else if ((resp?.data as any)?.items && Array.isArray((resp.data as any).items)) {
          posts = (resp.data as any).items;
        }
      } catch (boxErr) {
        console.warn("[Instagram Posts] BoxAPI list_posts notice:", boxErr);
      }

      return NextResponse.json({ success: true, data: posts });
    }

    // ── Meta Graph API Provider Branch ──────────────────────────────────────
    let posts: any[] = [];
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
