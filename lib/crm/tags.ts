/**
 * OpenReply CRM Tagging & Segmentation Engine
 * Manages tags, assigns tags to leads, and triggers Drip campaigns on tag assignment.
 */

import { prisma } from "@/lib/db/client";
import { enrollUserInDrip } from "@/lib/drip/drip-engine";

/**
 * Creates or retrieves a tag by name in the workspace.
 */
export async function getOrCreateTag(workspaceId: string, name: string, color = "#3b82f6") {
  const normalizedName = name.trim().toLowerCase();
  return prisma.tag.upsert({
    where: {
      workspaceId_name: {
        workspaceId,
        name: normalizedName,
      },
    },
    create: {
      workspaceId,
      name: normalizedName,
      color,
    },
    update: {},
  });
}

/**
 * Assigns a tag to a lead (by leadId or IGSID userId).
 * Also automatically triggers any active Drip Campaign bound to this tag.
 */
export async function addTagToLead(
  workspaceId: string,
  instagramAccountId: string,
  userId: string,
  tagName: string
) {
  const tag = await getOrCreateTag(workspaceId, tagName);

  // Ensure Lead record exists
  const lead = await prisma.lead.upsert({
    where: {
      id: `${workspaceId}_${userId}`,
    },
    update: {},
    create: {
      workspaceId,
      instagramAccountId,
      userId,
    },
  }).catch(async () => {
    let existingLead = await prisma.lead.findFirst({
      where: { workspaceId, userId },
    });
    if (!existingLead) {
      existingLead = await prisma.lead.create({
        data: { workspaceId, instagramAccountId, userId },
      });
    }
    return existingLead;
  });

  // Link Tag to Lead
  await prisma.leadTag.upsert({
    where: {
      leadId_tagId: {
        leadId: lead.id,
        tagId: tag.id,
      },
    },
    create: {
      leadId: lead.id,
      tagId: tag.id,
    },
    update: {},
  });

  // Check and enroll into matching Drip Campaigns
  const matchingDrips = await prisma.dripCampaign.findMany({
    where: {
      workspaceId,
      isActive: true,
      triggerType: "TAG_ADDED",
      triggerKey: tagName,
    },
  });

  for (const campaign of matchingDrips) {
    await enrollUserInDrip({
      workspaceId,
      instagramAccountId,
      userId,
      campaignId: campaign.id,
    });
  }

  return { success: true, tag, leadId: lead.id };
}

/**
 * Removes a tag from a lead.
 */
export async function removeTagFromLead(
  workspaceId: string,
  userId: string,
  tagName: string
) {
  const normalizedName = tagName.trim().toLowerCase();
  const tag = await prisma.tag.findUnique({
    where: {
      workspaceId_name: {
        workspaceId,
        name: normalizedName,
      },
    },
  });

  if (!tag) return { success: false, reason: "TAG_NOT_FOUND" };

  const lead = await prisma.lead.findFirst({
    where: { workspaceId, userId },
  });

  if (!lead) return { success: false, reason: "LEAD_NOT_FOUND" };

  await prisma.leadTag.deleteMany({
    where: {
      leadId: lead.id,
      tagId: tag.id,
    },
  });

  return { success: true };
}

/**
 * Gets all tags assigned to a lead.
 */
export async function getLeadTags(workspaceId: string, userId: string): Promise<string[]> {
  const lead = await prisma.lead.findFirst({
    where: { workspaceId, userId },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  if (!lead || !lead.tags) return [];
  return lead.tags.map((lt: any) => lt.tag.name);
}
