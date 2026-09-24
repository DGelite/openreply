import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma and Meta Graph API senders
vi.mock("@/lib/db/client", () => {
  const mockPrisma = {
    tag: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    lead: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    leadTag: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    dripCampaign: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    dripEnrollment: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    instagramAccount: {
      findFirst: vi.fn(),
    },
    conversationState: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock("@/lib/meta/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meta/client")>();
  return {
    ...actual,
    sendDirectMessage: vi.fn().mockResolvedValue({ message_id: "msg_123" }),
    sendDirectMediaMessage: vi.fn().mockResolvedValue({ message_id: "msg_media_123" }),
    sendDirectGenericTemplate: vi.fn().mockResolvedValue({ message_id: "msg_carousel_123" }),
    applyDangerZoneBackoff: vi.fn().mockResolvedValue(undefined),
  };
});

import { prisma } from "@/lib/db/client";
import { addTagToLead, removeTagFromLead, getLeadTags } from "@/lib/crm/tags";
import { enrollUserInDrip, processDueDripEnrollments } from "@/lib/drip/drip-engine";
import { executeFlowGraph } from "@/lib/flow/flow-engine";
import { FlowGraph } from "@/lib/flow/types";

describe("CRM Tagging & Drip Campaigns Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CRM Tagging", () => {
    it("should add a tag to a lead and create both lead and tag records", async () => {
      (prisma.tag.upsert as any).mockResolvedValue({ id: "tag_vip", name: "vip" });
      (prisma.lead.upsert as any).mockResolvedValue({ id: "lead_1", userId: "user_vip_1" });
      (prisma.leadTag.upsert as any).mockResolvedValue({ id: "lt_1", tagId: "tag_vip", leadId: "lead_1" });
      (prisma.dripCampaign.findMany as any).mockResolvedValue([]);

      const result = await addTagToLead("ws_1", "ig_acc_1", "user_vip_1", "VIP");

      expect(result.success).toBe(true);
      expect(prisma.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId_name: { workspaceId: "ws_1", name: "vip" } },
        })
      );
      expect(prisma.leadTag.upsert).toHaveBeenCalled();
    });

    it("should remove a tag from a lead gracefully", async () => {
      (prisma.tag.findUnique as any).mockResolvedValue({ id: "tag_vip", name: "vip" });
      (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead_1" });
      (prisma.leadTag.deleteMany as any).mockResolvedValue({ count: 1 });

      const result = await removeTagFromLead("ws_1", "user_vip_1", "VIP");

      expect(result.success).toBe(true);
      expect(prisma.leadTag.deleteMany).toHaveBeenCalledWith({
        where: { leadId: "lead_1", tagId: "tag_vip" },
      });
    });

    it("should return all tag names for a given lead", async () => {
      (prisma.lead.findFirst as any).mockResolvedValue({
        id: "lead_1",
        tags: [
          { tag: { name: "VIP" } },
          { tag: { name: "Buyer" } },
        ],
      });

      const tags = await getLeadTags("ws_1", "user_1");
      expect(tags).toEqual(["VIP", "Buyer"]);
    });
  });

  describe("Drip Campaign Automation", () => {
    it("should enroll a user into a drip campaign and schedule step 1", async () => {
      (prisma.dripCampaign.findUnique as any).mockResolvedValue({
        id: "camp_1",
        workspaceId: "ws_1",
        isActive: true,
        steps: [
          { id: "step_1", stepOrder: 1, delayMinutes: 30, messageText: "Welcome to Drip Step 1" },
          { id: "step_2", stepOrder: 2, delayMinutes: 120, messageText: "Follow-up Step 2" },
        ],
      });
      (prisma.dripEnrollment.upsert as any).mockResolvedValue({ id: "enr_1", status: "ACTIVE" });

      const result = await enrollUserInDrip({
        workspaceId: "ws_1",
        instagramAccountId: "ig_acc_1",
        userId: "user_drip_1",
        campaignId: "camp_1",
      });

      expect(result.success).toBe(true);
      expect(prisma.dripEnrollment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            campaignId: "camp_1",
            currentStepIndex: 0,
            status: "ACTIVE",
          }),
        })
      );
    });

    it("should process due drip enrollments and advance to the next step", async () => {
      const mockEnrollments = [
        {
          id: "enr_due_1",
          campaignId: "camp_1",
          workspaceId: "ws_1",
          instagramAccountId: "ig_acc_1",
          userId: "user_drip_1",
          currentStepIndex: 0,
          campaign: {
            workspace: {
              instagramAccounts: [
                {
                  id: "ig_acc_1",
                  instagramId: "ig_acc_1",
                  accessToken: "test_token",
                },
              ],
            },
            steps: [
              { id: "step_1", stepOrder: 1, delayMinutes: 30, messageText: "Drip msg 1", mediaUrl: null },
              { id: "step_2", stepOrder: 2, delayMinutes: 60, messageText: "Drip msg 2", mediaUrl: null },
            ],
          },
        },
      ];

      (prisma.dripEnrollment.findMany as any).mockResolvedValue(mockEnrollments);
      (prisma.dripEnrollment.update as any).mockResolvedValue({});
      (prisma.conversationState.findUnique as any).mockResolvedValue({
        lastInteractedAt: new Date(),
      });

      const processedResults = await processDueDripEnrollments();

      expect(processedResults.length).toBe(1);
      expect(processedResults[0].status).toBe("ADVANCED_TO_STEP_1");
      expect(prisma.dripEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "enr_due_1" },
          data: expect.objectContaining({
            currentStepIndex: 1,
          }),
        })
      );
    });
  });

  describe("Complex Multi-Node Visual Flow Traversal", () => {
    it("should process Carousel -> Add Tag -> Enroll Drip -> Human Handover flow cleanly", async () => {
      const complexGraph: FlowGraph = {
        nodes: [
          {
            id: "trig_1",
            type: "trigger",
            title: "Keyword Trigger",
            position: { x: 0, y: 0 },
            data: {
              type: "trigger",
              config: {
                triggerType: "COMMENT_KEYWORD",
                keywords: ["کاتالوگ"],
                matchAnyWord: false,
                wholeWordMatch: true,
              },
            },
          },
          {
            id: "carousel_1",
            type: "send_carousel",
            title: "Product Carousel",
            position: { x: 200, y: 0 },
            data: {
              type: "send_carousel",
              config: {
                cards: [
                  {
                    id: "c1",
                    title: "محصول طلایی",
                    subtitle: "پرفروش‌ترین محصول",
                    imageUrl: "https://example.com/p1.jpg",
                    buttons: [
                      { id: "b1", title: "خرید فوری", type: "web_url", url: "https://example.com/p1" },
                    ],
                  },
                ],
              },
            },
          },
          {
            id: "tag_1",
            type: "add_tag",
            title: "Tag as Interested",
            position: { x: 400, y: 0 },
            data: {
              type: "add_tag",
              config: { tagName: "CATALOG_REQUESTED" },
            },
          },
          {
            id: "drip_1",
            type: "enroll_drip",
            title: "Enroll in Nurture Campaign",
            position: { x: 600, y: 0 },
            data: {
              type: "enroll_drip",
              config: { campaignId: "camp_nurture_101" },
            },
          },
        ],
        edges: [
          { id: "e1", sourceNodeId: "trig_1", targetNodeId: "carousel_1" },
          { id: "e2", sourceNodeId: "carousel_1", targetNodeId: "tag_1" },
          { id: "e3", sourceNodeId: "tag_1", targetNodeId: "drip_1" },
        ],
      };

      const results = await executeFlowGraph(complexGraph, {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        userId: "user_lead_99",
        userMessage: "لطفا کاتالوگ رو برام بفرستید",
      });

      expect(results.length).toBe(4);
      expect(results[0].nodeType).toBe("trigger");
      expect(results[1].nodeType).toBe("send_carousel");
      expect(results[1].carouselToSend?.cards[0].title).toBe("محصول طلایی");
      expect(results[2].nodeType).toBe("add_tag");
      expect(results[2].tagAction?.tagName).toBe("CATALOG_REQUESTED");
      expect(results[3].nodeType).toBe("enroll_drip");
      expect(results[3].enrollDripCampaignId).toBe("camp_nurture_101");
    });
  });
});
