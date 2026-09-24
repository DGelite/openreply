import { prisma } from "@/lib/db/client";
import type { Workspace, WorkspaceRole } from "@/lib/generated/prisma/client";

function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function acceptPendingInvitationsForUser(
  userId: string,
  email?: string | null
): Promise<void> {
  if (!email) return;

  const normalizedEmail = normalizeInviteEmail(email);
  const now = new Date();
  const invitations = await prisma.workspaceInvitation.findMany({
    where: {
      email: normalizedEmail,
      status: "PENDING",
      expiresAt: { gt: now },
    },
  });

  for (const invitation of invitations) {
    await prisma.$transaction([
      prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId,
          },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
        update: {
          role: invitation.role,
        },
      }),
      prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: now,
        },
      }),
    ]);
  }
}

export async function getWorkspaceMembership(userId: string): Promise<{
  workspace: Workspace;
  role: WorkspaceRole;
} | null> {
  try {
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) return null;

    return {
      workspace: membership.workspace,
      role: membership.role,
    };
  } catch (error) {
    console.error("Error in getWorkspaceMembership:", error);
    try {
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
              ownerId: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      if (!membership || !membership.workspace) return null;

      return {
        workspace: membership.workspace as unknown as Workspace,
        role: membership.role,
      };
    } catch {
      return null;
    }
  }
}

export async function ensureWorkspaceForUser(
  userId: string,
  email?: string | null
): Promise<Workspace> {
  try {
    await acceptPendingInvitationsForUser(userId, email);
  } catch (e) {
    console.error("Failed to accept pending invitations:", e);
  }

  const existingMembership = await getWorkspaceMembership(userId);
  if (existingMembership) {
    return existingMembership.workspace;
  }

  const workspaceName = email ? `${email.split("@")[0]}'s workspace` : "ورک‌اسپیس اصلی";

  try {
    return await prisma.workspace.create({
      data: {
        name: workspaceName,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "OWNER",
          },
        },
      },
    });
  } catch (e) {
    console.error("Failed to create workspace:", e);
    return await prisma.workspace.upsert({
      where: { id: "admin-workspace-01" },
      create: {
        id: "admin-workspace-01",
        name: "ورک‌اسپیس اصلی",
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "OWNER",
          },
        },
      },
      update: {
        ownerId: userId,
      },
    });
  }
}

export async function getPrimaryWorkspace(userId: string): Promise<Workspace | null> {
  const membership = await getWorkspaceMembership(userId);
  return membership?.workspace ?? null;
}
