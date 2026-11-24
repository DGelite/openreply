import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { getUserInfo } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

// Live profile lookup (username + avatar) for the campaign preview.
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
      { success: false, error: "Instagram account not connected" },
      { status: 400 }
    );
  }

  try {
    // BoxAPI accounts do not store AES-GCM encrypted Meta access tokens
    if (
      account.primaryProvider === "BOXAPI" ||
      account.orchestrationMode === "BOXAPI_PRIMARY" ||
      !account.accessToken ||
      !account.accessToken.includes(":")
    ) {
      return NextResponse.json(
        {
          success: true,
          data: {
            username: account.username,
            name: account.name ?? null,
            profilePictureUrl: null,
          },
        },
        { headers: { "Cache-Control": "private, max-age=300" } }
      );
    }

    const token = decryptToken(account.accessToken);
    const info = await getUserInfo(token);
    return NextResponse.json(
      {
        success: true,
        data: {
          username: info.username,
          name: info.name ?? null,
          profilePictureUrl: info.profile_picture_url ?? null,
        },
      },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (err) {
    console.warn("[Instagram Profile] Graceful fallback:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        success: true,
        data: {
          username: account.username,
          name: account.name ?? null,
          profilePictureUrl: null,
        },
      },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  }
}
