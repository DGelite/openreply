import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

// Maximum upload size: 50MB (handles voice, music, photos, short videos)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "حجم فایل بیش از حد مجاز است (حداکثر ۵۰ مگابایت)." },
        { status: 413 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    let ext = path.extname(file.name || "").toLowerCase().replace(".", "");

    if (!ext) {
      if (mimeType.includes("audio/webm")) ext = "webm";
      else if (mimeType.includes("audio/ogg") || mimeType.includes("audio/opus")) ext = "ogg";
      else if (mimeType.includes("audio/mp4") || mimeType.includes("audio/m4a") || mimeType.includes("audio/x-m4a")) ext = "m4a";
      else if (mimeType.includes("audio/mpeg") || mimeType.includes("audio/mp3")) ext = "mp3";
      else if (mimeType.includes("audio/wav")) ext = "wav";
      else if (mimeType.includes("audio/aac")) ext = "aac";
      else if (mimeType.includes("image/jpeg")) ext = "jpg";
      else if (mimeType.includes("image/png")) ext = "png";
      else if (mimeType.includes("image/webp")) ext = "webp";
      else if (mimeType.includes("image/gif")) ext = "gif";
      else if (mimeType.includes("video/mp4")) ext = "mp4";
      else if (mimeType.includes("video/quicktime")) ext = "mov";
      else ext = "bin";
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "media");
    await mkdir(uploadsDir, { recursive: true });

    const filename = `${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    const relativeUrl = `/uploads/media/${filename}`;

    // Resolve full public HTTPS URL
    const envAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    let baseUrl = envAppUrl;
    if (!baseUrl) {
      const host = req.headers.get("host") || "insta.digitalelite.ir";
      const proto = req.headers.get("x-forwarded-proto") || "https";
      baseUrl = `${proto}://${host}`;
    }
    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
    const fullUrl = `${cleanBaseUrl}${relativeUrl}`;

    return NextResponse.json({
      success: true,
      url: relativeUrl,
      fullUrl,
      fileName: file.name,
      mimeType,
      size: buffer.length,
    });
  } catch (error) {
    console.error("[Media Upload API Error]:", error);
    return NextResponse.json(
      { error: "خطا در آپلود فایل رسانه" },
      { status: 500 }
    );
  }
}
