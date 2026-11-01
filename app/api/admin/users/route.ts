import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUserId } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { ensureWorkspaceForUser } from "@/lib/workspace";

export async function POST(req: Request) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
    });

    if (currentUser?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "فقط ادمین اصلی اجازه ساخت کاربر جدید را دارد." }, { status: 403 });
    }

    const body = await req.json();
    const { username, password, name, email, systemRole } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "نام کاربری و رمز عبور الزامی است." }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: username.trim() }, { email: email ? email.trim() : undefined }],
      },
    });

    if (existing) {
      return NextResponse.json({ error: "کاربری با این نام کاربری یا ایمیل قبلا ثبت شده است." }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        username: username.trim(),
        email: email ? email.trim() : `${username.trim()}@local.openreply`,
        name: name || username.trim(),
        passwordHash,
        systemRole: systemRole || "MEMBER",
      },
    });

    await ensureWorkspaceForUser(newUser.id, newUser.email || undefined);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        systemRole: newUser.systemRole,
      },
    });
  } catch (error: any) {
    console.error("Create User API error:", error);
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { systemRole: true },
    });

    if (currentUser?.systemRole !== "SUPER_ADMIN" && currentUser?.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "دسترسی غیرمجاز: فقط مدیران سیستم امکان مشاهده کاربران را دارند." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        systemRole: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
