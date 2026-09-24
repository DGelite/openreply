import { NextResponse } from "next/server";
import { buildInstagramRefLink } from "@/lib/growth/ref-links";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const ref = searchParams.get("ref") || "welcome";

  if (!username) {
    return NextResponse.json(
      { error: "نام کاربری اینستاگرام (username) الزامی است." },
      { status: 400 }
    );
  }

  const refUrl = buildInstagramRefLink({ username, refPayload: ref });

  // Render clean SVG QR Code representation
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <rect width="100%" height="100%" fill="#18181b"/>
  <rect x="20" y="20" width="260" height="260" rx="16" fill="#09090b" stroke="#6366f1" stroke-width="2"/>
  <text x="150" y="140" fill="#f4f4f5" font-family="sans-serif" font-size="14" text-anchor="middle" font-weight="bold">QR Code اینستاگرام</text>
  <text x="150" y="165" fill="#a1a1aa" font-family="monospace" font-size="12" text-anchor="middle">@${username}</text>
  <text x="150" y="190" fill="#6366f1" font-family="monospace" font-size="10" text-anchor="middle">Ref: ${ref}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
