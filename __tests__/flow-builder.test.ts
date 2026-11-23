import { describe, it, expect } from "vitest";
import { executeFlowGraph, evaluateConditionNode } from "@/lib/flow/flow-engine";
import { selectDmMessageVariation } from "@/lib/automation/ab-testing";
import { FlowGraph, FlowNode } from "@/lib/flow/types";

describe("Visual Flow Builder Engine Tests", () => {
  it("should evaluate condition node correctly for email presence", () => {
    const conditionNode: FlowNode = {
      id: "cond_1",
      type: "condition",
      title: "Check Email",
      position: { x: 0, y: 0 },
      data: {
        type: "condition",
        config: { variable: "has_email", operator: "equals" },
      },
    };

    const hasEmailResult = evaluateConditionNode(conditionNode, {
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "user_1",
      hasEmail: true,
    });

    const noEmailResult = evaluateConditionNode(conditionNode, {
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "user_1",
      hasEmail: false,
    });

    expect(hasEmailResult).toBe(true);
    expect(noEmailResult).toBe(false);
  });

  it("should traverse flow graph from trigger to send_dm node", async () => {
    const testGraph: FlowGraph = {
      nodes: [
        {
          id: "trig_1",
          type: "trigger",
          title: "Trigger",
          position: { x: 0, y: 0 },
          data: {
            type: "trigger",
            config: {
              triggerType: "COMMENT_KEYWORD",
              keywords: ["قیمت", "لینک"],
              matchAnyWord: false,
              wholeWordMatch: true,
            },
          },
        },
        {
          id: "dm_1",
          type: "send_dm",
          title: "Send DM",
          position: { x: 200, y: 0 },
          data: {
            type: "send_dm",
            config: {
              message: "سلام! قیمت محصول ۵۰۰ هزار تومان است.",
              buttonLabel: "خرید آنلاین",
              buttonUrl: "https://example.com/buy",
            },
          },
        },
      ],
      edges: [
        {
          id: "edge_1",
          sourceNodeId: "trig_1",
          targetNodeId: "dm_1",
        },
      ],
    };

    const results = await executeFlowGraph(testGraph, {
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "user_1",
      userMessage: "سلام قیمت این محصول چنده؟",
    });

    expect(results.length).toBe(2);
    expect(results[0].nodeType).toBe("trigger");
    expect(results[1].nodeType).toBe("send_dm");
    expect(results[1].dmMessageToSend).toBe("سلام! قیمت محصول ۵۰۰ هزار تومان است.");
    expect(results[1].linkButton?.url).toBe("https://example.com/buy");
  });

  it("should halt traversal on collect_input node and request user email", async () => {
    const graph: FlowGraph = {
      nodes: [
        {
          id: "trig_1",
          type: "trigger",
          title: "Trigger",
          position: { x: 0, y: 0 },
          data: {
            type: "trigger",
            config: { triggerType: "COMMENT_KEYWORD", keywords: ["ثبت‌نام"], matchAnyWord: false, wholeWordMatch: true },
          },
        },
        {
          id: "collect_1",
          type: "collect_input",
          title: "Collect Email",
          position: { x: 200, y: 0 },
          data: {
            type: "collect_input",
            config: { inputType: "email", promptMessage: "لطفا ایمیل خود را وارد کنید:" },
          },
        },
      ],
      edges: [{ id: "e1", sourceNodeId: "trig_1", targetNodeId: "collect_1" }],
    };

    const results = await executeFlowGraph(graph, {
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "user_1",
      userMessage: "ثبت‌نام",
    });

    expect(results.length).toBe(2);
    expect(results[0].nodeType).toBe("trigger");
    expect(results[1].nodeType).toBe("collect_input");
    expect(results[1].requiresInput).toBe("AWAITING_EMAIL");
    expect(results[1].dmMessageToSend).toBe("لطفا ایمیل خود را وارد کنید:");
  });

  it("should halt traversal on collect_input node for phone collection with prompt", async () => {
    const graph: FlowGraph = {
      nodes: [
        {
          id: "trig_1",
          type: "trigger",
          title: "Trigger",
          position: { x: 0, y: 0 },
          data: {
            type: "trigger",
            config: {
              triggerType: "DIRECT_MESSAGE",
              keywords: ["مشاوره"],
              matchAnyWord: false,
              wholeWordMatch: true,
            },
          },
        },
        {
          id: "collect_phone",
          type: "collect_input",
          title: "Collect Phone",
          position: { x: 200, y: 0 },
          data: {
            type: "collect_input",
            config: {
              inputType: "phone",
              promptMessage: "لطفاً شماره تماس خود را ارسال کنید:",
              successMessage: "ثبت شد!",
            },
          },
        },
      ],
      edges: [{ id: "e1", sourceNodeId: "trig_1", targetNodeId: "collect_phone" }],
    };

    const results = await executeFlowGraph(graph, {
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "user_1",
      userMessage: "سلام وقت بخیر برای مشاوره پیام دادم",
    });

    expect(results.length).toBe(2);
    expect(results[0].nodeType).toBe("trigger");
    expect(results[1].nodeType).toBe("collect_input");
    expect(results[1].requiresInput).toBe("AWAITING_PHONE");
    expect(results[1].dmMessageToSend).toBe("لطفاً شماره تماس خود را ارسال کنید:");
  });

  it("should rotate A/B testing message variations", () => {
    const variationsText = "گزینه اول دایرکت\n---\nگزینه دوم دایرکت";
    const selected = selectDmMessageVariation(variationsText);
    expect(["گزینه اول دایرکت", "گزینه دوم دایرکت"]).toContain(selected);
  });

  it("should evaluate condition node correctly using UI schema (ruleType / tagName / textValue)", () => {
    const tagConditionNode: FlowNode = {
      id: "cond_tag",
      type: "condition",
      title: "Check Tag VIP",
      position: { x: 0, y: 0 },
      data: {
        type: "condition",
        config: { ruleType: "HAS_TAG", tagName: "vip" } as any,
      },
    };

    expect(
      evaluateConditionNode(tagConditionNode, {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        userId: "user_1",
        userTags: ["vip", "interested"],
      })
    ).toBe(true);

    expect(
      evaluateConditionNode(tagConditionNode, {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        userId: "user_1",
        userTags: ["customer"],
      })
    ).toBe(false);

    const textConditionNode: FlowNode = {
      id: "cond_text",
      type: "condition",
      title: "Check Text",
      position: { x: 0, y: 0 },
      data: {
        type: "condition",
        config: { ruleType: "TEXT_CONTAINS", textValue: "خرید فوری" } as any,
      },
    };

    expect(
      evaluateConditionNode(textConditionNode, {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        userId: "user_1",
        userMessage: "سلام برای خرید فوری مراجعه کردم",
      })
    ).toBe(true);
  });

  it("should correctly traverse send_media voice node and normalize audio", async () => {
    const mediaGraph: FlowGraph = {
      nodes: [
        {
          id: "trig_media",
          type: "trigger",
          title: "Trigger",
          position: { x: 0, y: 0 },
          data: {
            type: "trigger",
            config: { triggerType: "ALL", keywords: [], matchAnyWord: true, wholeWordMatch: false },
          },
        },
        {
          id: "media_voice",
          type: "send_media",
          title: "Send Voice Note",
          position: { x: 200, y: 0 },
          data: {
            type: "send_media",
            config: {
              mediaType: "audio",
              mediaUrl: "https://insta.digitalelite.ir/uploads/media/voice_sample.mp3",
              caption: "صدای ارسالی مشاوره",
            },
          },
        },
      ],
      edges: [{ id: "e1", sourceNodeId: "trig_media", targetNodeId: "media_voice" }],
    };

    const results = await executeFlowGraph(mediaGraph, {
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "user_1",
      userMessage: "هر پیامی",
    });

    expect(results.length).toBe(2);
    expect(results[1].nodeType).toBe("send_media");
    expect(results[1].actionTaken).toBe("SEND_MEDIA_AUDIO");
    expect(results[1].mediaToSend?.mediaType).toBe("audio");
    expect(results[1].mediaToSend?.mediaUrl).toBe("https://insta.digitalelite.ir/uploads/media/voice_sample.mp3");
  });

  it("should advance correctly through nested node connections when resuming at quick_reply", async () => {
    const nestedGraph: FlowGraph = {
      nodes: [
        {
          id: "trig_1",
          type: "trigger",
          title: "Trigger",
          position: { x: 0, y: 0 },
          data: {
            type: "trigger",
            config: { triggerType: "COMMENT_KEYWORD", keywords: ["شروع"], matchAnyWord: false, wholeWordMatch: true },
          },
        },
        {
          id: "dm_intro",
          type: "send_dm",
          title: "Intro DM",
          position: { x: 200, y: 0 },
          data: {
            type: "send_dm",
            config: { message: "به دوره دیجیتال الیت خوش آمدید!" },
          },
        },
        {
          id: "qr_options",
          type: "quick_reply",
          title: "Quick Reply Options",
          position: { x: 400, y: 0 },
          data: {
            type: "quick_reply",
            config: {
              messageText: "کدام بخش را می‌خواهید؟",
              quickReplies: [
                { title: "کاتالوگ", payload: "catalog_choice" },
                { title: "تماس", payload: "call_choice" },
              ],
            } as any,
          },
        },
        {
          id: "media_catalog",
          type: "send_media",
          title: "Send Catalog Audio",
          position: { x: 600, y: 0 },
          data: {
            type: "send_media",
            config: {
              mediaType: "audio",
              mediaUrl: "https://insta.digitalelite.ir/uploads/media/catalog_voice.ogg",
            },
          },
        },
        {
          id: "tag_interested",
          type: "add_tag",
          title: "Tag User",
          position: { x: 800, y: 0 },
          data: {
            type: "add_tag",
            config: { tagName: "catalog_downloaded" },
          },
        },
        {
          id: "dm_final",
          type: "send_dm",
          title: "Final DM",
          position: { x: 1000, y: 0 },
          data: {
            type: "send_dm",
            config: { message: "وویس توضیحات ارسال شد! متشکریم." },
          },
        },
      ],
      edges: [
        { id: "e1", sourceNodeId: "trig_1", targetNodeId: "dm_intro" },
        { id: "e2", sourceNodeId: "dm_intro", targetNodeId: "qr_options" },
        { id: "e3", sourceNodeId: "qr_options", targetNodeId: "media_catalog", conditionBranch: "catalog_choice" },
        { id: "e4", sourceNodeId: "media_catalog", targetNodeId: "tag_interested" },
        { id: "e5", sourceNodeId: "tag_interested", targetNodeId: "dm_final" },
      ],
    };

    // Phase 1: User comments "شروع" -> runs until quick_reply and pauses
    const phase1Results = await executeFlowGraph(nestedGraph, {
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "user_1",
      userMessage: "شروع",
    });

    expect(phase1Results.length).toBe(3);
    expect(phase1Results[0].nodeType).toBe("trigger");
    expect(phase1Results[1].nodeType).toBe("send_dm");
    expect(phase1Results[2].nodeType).toBe("quick_reply");
    expect(phase1Results[2].requiresInput).toBe("FLOW_NODE");

    // Phase 2: User taps "catalog_choice" -> resumes at qr_options and runs all chained downstream nodes
    const phase2Results = await executeFlowGraph(
      nestedGraph,
      {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        userId: "user_1",
        selectedQuickReplyPayload: "catalog_choice",
      },
      "qr_options"
    );

    expect(phase2Results.length).toBe(3);
    expect(phase2Results[0].nodeType).toBe("send_media");
    expect(phase2Results[0].mediaToSend?.mediaUrl).toBe("https://insta.digitalelite.ir/uploads/media/catalog_voice.ogg");
    expect(phase2Results[1].nodeType).toBe("add_tag");
    expect(phase2Results[1].tagAction?.tagName).toBe("catalog_downloaded");
    expect(phase2Results[2].nodeType).toBe("send_dm");
    expect(phase2Results[2].dmMessageToSend).toBe("وویس توضیحات ارسال شد! متشکریم.");
  });
});
