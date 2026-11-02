import { NextRequest, NextResponse } from "next/server";
import { executeFlowGraph } from "@/lib/flow/flow-engine";
import { FlowGraph } from "@/lib/flow/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { graph, testMessage } = await req.json();
    if (!graph || !graph.nodes) {
      return NextResponse.json({ success: false, error: "Invalid graph" }, { status: 400 });
    }

    const results = await executeFlowGraph(graph as FlowGraph, {
      workspaceId: "test_ws",
      instagramAccountId: "test_ig",
      userId: "user_test_123",
      username: "test_user",
      userMessage: testMessage || "سلام",
      hasEmail: false,
      hasPhone: false,
    });

    return NextResponse.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
