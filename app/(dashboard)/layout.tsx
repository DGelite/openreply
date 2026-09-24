export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser } from "@/lib/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  let workspaceName = "ورک‌اسپیس اصلی";
  let instagramUsername: string | null = null;
  let instagramAccountCount = 0;

  try {
    const workspace = await ensureWorkspaceForUser(
      session.user.id,
      session.user.email
    );
    workspaceName = workspace.name;

    const accounts = await prisma.instagramAccount.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { connectedAt: "desc" },
      select: { username: true },
    }).catch(() => []);

    instagramUsername = accounts[0]?.username ?? null;
    instagramAccountCount = accounts.length;
  } catch (error) {
    console.error("Dashboard layout error:", error);
  }

  return (
    <DashboardShell
      workspaceName={workspaceName}
      instagramUsername={instagramUsername}
      instagramAccountCount={instagramAccountCount}
    >
      {children}
    </DashboardShell>
  );
}
