import { describe, it, expect } from "vitest";
import { executeFlowGraph, evaluateConditionNode } from "@/lib/flow/flow-engine";
import { FlowGraph, FlowNode, FlowEdge } from "@/lib/flow/types";
import { domainEdgeToReactFlowEdge, reactFlowEdgeToDomainEdge } from "@/components/flow-builder/flow-builder";

describe("ManyChat-Style Multi-Button & Quick-Reply Branching Tests", () => {
  it("should pause execution on send_dm when postback buttons are connected to child branches", async () => {
    const branchingGraph: FlowGraph = {
      nodes: [
        {
          id: "trig_start",
          type: "trigger",
          title: "Trigger",
          position: { x: 0, y: 0 },
          data: {
            type: "trigger",
            config: { triggerType: "COMMENT_KEYWORD", keywords: ["محصول"], matchAnyWord: false, wholeWordMatch: true },
          },
        },
        {
          id: "dm_menu",
          type: "send_dm",
          title: "Menu DM",
          position: { x: 200, y: 0 },
          data: {
            type: "send_dm",
            config: {
              message: "سلام! به کدام بخش علاقه دارید؟",
              buttons: [
                { id: "btn_courses", type: "postback", title: "دوره جامع", payload: "flow_btn:auto1:dm_menu:btn_courses" },
                { id: "btn_consulting", type: "postback", title: "مشاوره خصوصی", payload: "flow_btn:auto1:dm_menu:btn_consulting" },
                { id: "btn_website", type: "web_url", title: "وبسایت", url: "https://digitalelite.ir" },
              ],
            },
          },
        },
        {
          id: "dm_courses_info",
          type: "send_dm",
          title: "Courses Info",
          position: { x: 500, y: -100 },
          data: {
            type: "send_dm",
            config: { message: "اطلاعات دوره جامع دیجیتال الیت خدمت شما:" },
          },
        },
        {
          id: "collect_phone_consulting",
          type: "collect_input",
          title: "Collect Phone for Consulting",
          position: { x: 500, y: 100 },
          data: {
            type: "collect_input",
            config: { inputType: "phone", promptMessage: "لطفا شماره همراه خود را برای هماهنگی مشاوره وارد کنید:" },
          },
        },
      ],
      edges: [
        { id: "e_trig", sourceNodeId: "trig_start", targetNodeId: "dm_menu" },
        { id: "e_branch_1", sourceNodeId: "dm_menu", targetNodeId: "dm_courses_info", sourceHandle: "btn_courses" },
        { id: "e_branch_2", sourceNodeId: "dm_menu", targetNodeId: "collect_phone_consulting", sourceHandle: "btn_consulting" },
      ],
    };

    // Phase 1: User comments "محصول" -> executes trigger and send_dm, then pauses waiting for button click
    const phase1Results = await executeFlowGraph(branchingGraph, {
      workspaceId: "ws_test",
      instagramAccountId: "ig_test",
      automationId: "auto1",
      userId: "user_branch_1",
      userMessage: "محصول",
    });

    expect(phase1Results.length).toBe(2);
    expect(phase1Results[0].nodeType).toBe("trigger");
    expect(phase1Results[1].nodeType).toBe("send_dm");
    expect(phase1Results[1].buttons?.length).toBe(3);
    expect(phase1Results[1].requiresInput).toBe("FLOW_NODE");
    expect(phase1Results.some((r) => r.nodeId === "dm_courses_info")).toBe(false);
    expect(phase1Results.some((r) => r.nodeId === "collect_phone_consulting")).toBe(false);

    // Phase 2: User clicks Button 1 ("btn_courses") -> resumes and executes ONLY Courses branch
    const branch1Results = await executeFlowGraph(
      branchingGraph,
      {
        workspaceId: "ws_test",
        instagramAccountId: "ig_test",
        automationId: "auto1",
        userId: "user_branch_1",
        clickedButtonId: "btn_courses",
        clickedButtonPayload: "flow_btn:auto1:dm_menu:btn_courses",
      },
      "dm_courses_info"
    );

    expect(branch1Results.length).toBe(1);
    expect(branch1Results[0].nodeId).toBe("dm_courses_info");
    expect(branch1Results[0].dmMessageToSend).toBe("اطلاعات دوره جامع دیجیتال الیت خدمت شما:");

    // Phase 3: User clicks Button 2 ("btn_consulting") -> resumes and executes ONLY Consulting branch
    const branch2Results = await executeFlowGraph(
      branchingGraph,
      {
        workspaceId: "ws_test",
        instagramAccountId: "ig_test",
        automationId: "auto1",
        userId: "user_branch_1",
        clickedButtonId: "btn_consulting",
        clickedButtonPayload: "flow_btn:auto1:dm_menu:btn_consulting",
      },
      "collect_phone_consulting"
    );

    expect(branch2Results.length).toBe(1);
    expect(branch2Results[0].nodeId).toBe("collect_phone_consulting");
    expect(branch2Results[0].requiresInput).toBe("AWAITING_PHONE");
  });

  it("should support parent node resumption when clickedButtonId is passed with parent startNodeId", async () => {
    const graph: FlowGraph = {
      nodes: [
        {
          id: "node_msg",
          type: "send_dm",
          title: "Ask User",
          position: { x: 0, y: 0 },
          data: {
            type: "send_dm",
            config: {
              message: "انتخاب کنید:",
              buttons: [
                { id: "b1", type: "postback", title: "گزینه ۱" },
                { id: "b2", type: "postback", title: "گزینه ۲" },
              ],
            },
          },
        },
        {
          id: "node_b1",
          type: "send_dm",
          title: "Branch 1",
          position: { x: 200, y: -50 },
          data: { type: "send_dm", config: { message: "پاسخ شاخه اول" } },
        },
        {
          id: "node_b2",
          type: "send_dm",
          title: "Branch 2",
          position: { x: 200, y: 50 },
          data: { type: "send_dm", config: { message: "پاسخ شاخه دوم" } },
        },
      ],
      edges: [
        { id: "e1", sourceNodeId: "node_msg", targetNodeId: "node_b1", sourceHandle: "b1" },
        { id: "e2", sourceNodeId: "node_msg", targetNodeId: "node_b2", sourceHandle: "b2" },
      ],
    };

    // Resume with clickedButtonId = "b2" starting from parent "node_msg"
    const results = await executeFlowGraph(
      graph,
      {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        userId: "u1",
        clickedButtonId: "b2",
      },
      "node_msg"
    );

    expect(results.length).toBe(1);
    expect(results[0].nodeId).toBe("node_b2");
    expect(results[0].dmMessageToSend).toBe("پاسخ شاخه دوم");
  });

  it("should support independent Quick Reply chip branching via dedicated handles", async () => {
    const qrGraph: FlowGraph = {
      nodes: [
        {
          id: "qr_node",
          type: "quick_reply",
          title: "Select Option",
          position: { x: 0, y: 0 },
          data: {
            type: "quick_reply",
            config: {
              text: "لطفا یک گزینه انتخاب کنید:",
              chips: [
                { id: "chip_faq", title: "سوالات متداول", payload: "choice_faq" },
                { id: "chip_support", title: "پشتیبانی", payload: "choice_support" },
              ],
            },
          },
        },
        {
          id: "dm_faq",
          type: "send_dm",
          title: "FAQ Content",
          position: { x: 200, y: -50 },
          data: { type: "send_dm", config: { message: "اینجا لیست سوالات متداول است..." } },
        },
        {
          id: "handover_node",
          type: "handover_to_human",
          title: "Human Support",
          position: { x: 200, y: 50 },
          data: { type: "handover_to_human", config: { notificationMessage: "به اپراتور متصل شدید." } },
        },
      ],
      edges: [
        { id: "e_faq", sourceNodeId: "qr_node", targetNodeId: "dm_faq", sourceHandle: "choice_faq" },
        { id: "e_sup", sourceNodeId: "qr_node", targetNodeId: "handover_node", sourceHandle: "choice_support" },
      ],
    };

    // User chooses FAQ
    const faqResults = await executeFlowGraph(
      qrGraph,
      {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        userId: "u1",
        selectedQuickReplyPayload: "choice_faq",
      },
      "qr_node"
    );

    expect(faqResults.length).toBe(1);
    expect(faqResults[0].nodeId).toBe("dm_faq");
    expect(faqResults[0].dmMessageToSend).toBe("اینجا لیست سوالات متداول است...");

    // User chooses Support
    const supportResults = await executeFlowGraph(
      qrGraph,
      {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        userId: "u1",
        selectedQuickReplyPayload: "choice_support",
      },
      "qr_node"
    );

    expect(supportResults.length).toBe(1);
    expect(supportResults[0].nodeId).toBe("handover_node");
    expect(supportResults[0].actionTaken).toBe("HANDOVER_TO_HUMAN");
  });

  it("should preserve backward compatibility for legacy flows without button handles", async () => {
    const legacyGraph: FlowGraph = {
      nodes: [
        {
          id: "trig_leg",
          type: "trigger",
          title: "Trigger",
          position: { x: 0, y: 0 },
          data: {
            type: "trigger",
            config: { triggerType: "COMMENT_KEYWORD", keywords: ["تست"], matchAnyWord: false, wholeWordMatch: true },
          },
        },
        {
          id: "dm_leg",
          type: "send_dm",
          title: "Legacy Send DM",
          position: { x: 200, y: 0 },
          data: {
            type: "send_dm",
            config: {
              message: "پیام خطی اول",
              buttons: [{ type: "web_url", title: "مشاهده لینک", url: "https://example.com" }],
            },
          },
        },
        {
          id: "dm_next",
          type: "send_dm",
          title: "Next Linear DM",
          position: { x: 400, y: 0 },
          data: {
            type: "send_dm",
            config: { message: "پیام خطی دوم" },
          },
        },
      ],
      edges: [
        { id: "e1", sourceNodeId: "trig_leg", targetNodeId: "dm_leg" },
        { id: "e2", sourceNodeId: "dm_leg", targetNodeId: "dm_next" }, // No sourceHandle (legacy)
      ],
    };

    const results = await executeFlowGraph(legacyGraph, {
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "u1",
      userMessage: "تست",
    });

    // In a legacy linear flow without postback buttons, it traverses straight through dm_leg -> dm_next
    expect(results.length).toBe(3);
    expect(results[0].nodeId).toBe("trig_leg");
    expect(results[1].nodeId).toBe("dm_leg");
    expect(results[2].nodeId).toBe("dm_next");
  });

  it("should accurately roundtrip edge sourceHandles between domain model and React Flow", () => {
    // 1. Button edge roundtrip
    const buttonDomainEdge: FlowEdge = {
      id: "edge_btn_1",
      sourceNodeId: "node_1",
      targetNodeId: "node_2",
      sourceHandle: "btn_xyz123",
    };

    const rfEdge1 = domainEdgeToReactFlowEdge(buttonDomainEdge);
    expect(rfEdge1.sourceHandle).toBe("btn_xyz123");

    const roundtripped1 = reactFlowEdgeToDomainEdge(rfEdge1);
    expect(roundtripped1.sourceHandle).toBe("btn_xyz123");
    expect(roundtripped1.targetNodeId).toBe("node_2");

    // 2. Condition node edge roundtrip (yes/no)
    const conditionDomainEdge: FlowEdge = {
      id: "edge_cond_yes",
      sourceNodeId: "node_cond",
      targetNodeId: "node_yes_target",
      conditionBranch: "yes",
    };

    const rfEdge2 = domainEdgeToReactFlowEdge(conditionDomainEdge);
    expect(rfEdge2.sourceHandle).toBe("yes");

    const roundtripped2 = reactFlowEdgeToDomainEdge(rfEdge2);
    expect(roundtripped2.sourceHandle).toBe("yes");
    expect(roundtripped2.conditionBranch).toBe("yes");

    // 3. Quick reply chip edge roundtrip
    const qrDomainEdge: FlowEdge = {
      id: "edge_chip_1",
      sourceNodeId: "node_qr",
      targetNodeId: "node_qr_target",
      sourceHandle: "choice_price_list",
    };

    const rfEdge3 = domainEdgeToReactFlowEdge(qrDomainEdge);
    expect(rfEdge3.sourceHandle).toBe("choice_price_list");

    const roundtripped3 = reactFlowEdgeToDomainEdge(rfEdge3);
    expect(roundtripped3.sourceHandle).toBe("choice_price_list");

    // 4. Legacy edge without sourceHandle
    const legacyEdge: FlowEdge = {
      id: "edge_legacy",
      sourceNodeId: "node_a",
      targetNodeId: "node_b",
    };

    const rfEdge4 = domainEdgeToReactFlowEdge(legacyEdge);
    expect(rfEdge4.sourceHandle).toBeUndefined();

    const roundtripped4 = reactFlowEdgeToDomainEdge(rfEdge4);
    expect(roundtripped4.sourceHandle).toBeUndefined();
    expect(roundtripped4.conditionBranch).toBeUndefined();
  });

  it("should support deeply nested flows: Button -> Condition (Yes/No) -> Downstream Buttons", async () => {
    const deepGraph: FlowGraph = {
      nodes: [
        {
          id: "trig",
          type: "trigger",
          title: "Trigger",
          position: { x: 0, y: 0 },
          data: { type: "trigger", config: { triggerType: "ALL", keywords: [], matchAnyWord: true, wholeWordMatch: false } },
        },
        {
          id: "msg_menu",
          type: "send_dm",
          title: "Main Menu",
          position: { x: 150, y: 0 },
          data: {
            type: "send_dm",
            config: {
              message: "خوش آمدید! یکی از گزینه‌ها را انتخاب کنید:",
              buttons: [
                { id: "btn_vip", type: "postback", title: "ورود به بخش VIP" },
                { id: "btn_free", type: "postback", title: "محتوای رایگان" },
              ],
            },
          },
        },
        {
          id: "check_vip",
          type: "condition",
          title: "Check VIP Tag",
          position: { x: 350, y: -50 },
          data: { type: "condition", config: { ruleType: "HAS_TAG", tagName: "vip_member" } as any },
        },
        {
          id: "vip_access",
          type: "send_dm",
          title: "VIP Content Access",
          position: { x: 600, y: -100 },
          data: { type: "send_dm", config: { message: "دسترسی ویژه شما تایید شد!" } },
        },
        {
          id: "vip_denied",
          type: "send_dm",
          title: "VIP Denied",
          position: { x: 600, y: 0 },
          data: { type: "send_dm", config: { message: "شما هنوز عضو ویژه نیستید. از لینک زیر ارتقا دهید." } },
        },
      ],
      edges: [
        { id: "e1", sourceNodeId: "trig", targetNodeId: "msg_menu" },
        { id: "e2", sourceNodeId: "msg_menu", targetNodeId: "check_vip", sourceHandle: "btn_vip" },
        { id: "e3", sourceNodeId: "check_vip", targetNodeId: "vip_access", conditionBranch: "yes" },
        { id: "e4", sourceNodeId: "check_vip", targetNodeId: "vip_denied", conditionBranch: "no" },
      ],
    };

    // User clicks "btn_vip" and HAS "vip_member" tag -> should navigate to vip_access
    const vipUserResults = await executeFlowGraph(
      deepGraph,
      {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        userId: "user_vip",
        userTags: ["vip_member"],
        clickedButtonId: "btn_vip",
      },
      "check_vip"
    );

    expect(vipUserResults.length).toBe(2);
    expect(vipUserResults[0].nodeType).toBe("condition");
    expect(vipUserResults[0].actionTaken).toBe("EVALUATE_CONDITION_YES");
    expect(vipUserResults[1].nodeId).toBe("vip_access");
    expect(vipUserResults[1].dmMessageToSend).toBe("دسترسی ویژه شما تایید شد!");

    // User clicks "btn_vip" but DOES NOT have "vip_member" tag -> should navigate to vip_denied
    const regularUserResults = await executeFlowGraph(
      deepGraph,
      {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        userId: "user_regular",
        userTags: ["free_user"],
        clickedButtonId: "btn_vip",
      },
      "check_vip"
    );

    expect(regularUserResults.length).toBe(2);
    expect(regularUserResults[0].nodeType).toBe("condition");
    expect(regularUserResults[0].actionTaken).toBe("EVALUATE_CONDITION_NO");
    expect(regularUserResults[1].nodeId).toBe("vip_denied");
    expect(regularUserResults[1].dmMessageToSend).toBe("شما هنوز عضو ویژه نیستید. از لینک زیر ارتقا دهید.");
  });
});
