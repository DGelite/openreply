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

  it("should rotate A/B testing message variations", () => {
    const variationsText = "گزینه اول دایرکت\n---\nگزینه دوم دایرکت";
    const selected = selectDmMessageVariation(variationsText);
    expect(["گزینه اول دایرکت", "گزینه دوم دایرکت"]).toContain(selected);
  });
});
