"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import NodeLibrary from "./node-library";
import NodeInspector from "./node-inspector";
import { BaseCustomNode } from "./custom-node";
import {
  FlowGraph,
  FlowNode as DomainNode,
  FlowEdge as DomainEdge,
  FlowNodeType,
} from "@/lib/flow/types";
import { executeFlowGraph, FlowStepResult } from "@/lib/flow/flow-engine";

interface FlowBuilderProps {
  initialGraph?: FlowGraph;
  flowName?: string;
  flowId?: string;
  onSave?: (name: string, graph: FlowGraph) => Promise<void>;
}

const DEFAULT_GRAPH: FlowGraph = {
  nodes: [
    {
      id: "node_trigger_1",
      type: "trigger",
      title: "محرک اولیه (Trigger)",
      position: { x: 60, y: 120 },
      data: {
        type: "trigger",
        config: {
          triggerType: "COMMENT_KEYWORD",
          keywords: ["قیمت", "خرید", "لینک"],
          matchAnyWord: false,
          wholeWordMatch: true,
        },
      },
    },
    {
      id: "node_dm_1",
      type: "send_dm",
      title: "ارسال پیام دایرکت اولیه",
      position: { x: 380, y: 120 },
      data: {
        type: "send_dm",
        config: {
          message: "سلام! لینک درخواست‌شده برای شما ارسال شد 🙏",
          publicReplyEnabled: false,
          publicReplyMessages: [],
        },
      },
    },
  ],
  edges: [
    {
      id: "edge_1",
      sourceNodeId: "node_trigger_1",
      targetNodeId: "node_dm_1",
    },
  ],
};

const NODE_TYPE_DEFAULT_TITLES: Record<FlowNodeType, string> = {
  trigger: "محرک (Trigger)",
  send_dm: "ارسال پیام متنی",
  send_media: "ارسال مدیا",
  send_carousel: "اسلایدر محصولات",
  quick_reply: "پاسخ‌های سریع",
  condition: "بررسی شرط",
  add_tag: "افزودن برچسب لید",
  remove_tag: "حذف برچسب لید",
  enroll_drip: "کمپین قطره‌ای",
  ai_reply: "پاسخ هوش مصنوعی",
  handover_to_human: "انتقال به پشتیبان",
  collect_input: "دریافت اطلاعات",
  webhook_action: "ارسال به وب‌هوک",
  smart_delay: "تاخیر هوشمند",
};

// --- Converters ---
function domainNodeToReactFlowNode(n: DomainNode, index: number): Node {
  const t = n.type;
  let previewText = "...";
  const conf = (n.data?.config as any) || {};
  if (t === "trigger") previewText = conf.triggerType || "شروع فلو";
  else if (t === "send_dm") previewText = conf.messageText || conf.message || "ارسال پیام متنی";
  else if (t === "send_media") previewText = `${conf.mediaType || "عکس"}: ${conf.mediaUrl ? "تنظیم شده" : "بدون لینک"}`;
  else if (t === "send_carousel") previewText = `${conf.elements?.length || 0} کارت اسلایدر`;
  else if (t === "quick_reply") previewText = conf.messageText || "پاسخ‌های سریع";
  else if (t === "condition") previewText = `شرط: ${conf.ruleType || "HAS_TAG"}`;
  else if (t === "add_tag") previewText = `تگ: ${conf.tagName || "بدون نام"}`;
  else if (t === "remove_tag") previewText = `حذف تگ: ${conf.tagName || "بدون نام"}`;
  else if (t === "enroll_drip") previewText = `کمپین: ${conf.campaignId || "انتخاب نشده"}`;
  else if (t === "ai_reply") previewText = conf.prompt ? "پرامپت هوش مصنوعی فعال" : "پاسخ هوشمند خودکار";
  else if (t === "handover_to_human") previewText = conf.reason || "انتقال به اپراتور";
  else if (t === "smart_delay") previewText = `تاخیر ${conf.delayAmount || conf.delayMinutes || 5} ${conf.delayUnit || "دقیقه"}`;
  else if (t === "collect_input") previewText = `دریافت ${conf.inputType || "اطلاعات"}`;
  else if (t === "webhook_action") previewText = conf.webhookUrl ? "وب‌هوک فعال" : "بدون آدرس";

  return {
    id: n.id,
    type: "custom",
    position: n.position,
    data: {
      ...n.data,
      title: n.title,
      stepIndex: index,
      type: n.type,
      previewText,
    },
  };
}

function reactFlowNodeToDomainNode(n: Node): DomainNode {
  return {
    id: n.id,
    type: n.data.type as FlowNodeType,
    title: n.data.title as string,
    position: n.position,
    data: {
      type: n.data.type,
      config: n.data.config,
    } as any,
  };
}

function domainEdgeToReactFlowEdge(e: DomainEdge): Edge {
  return {
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    sourceHandle: e.conditionBranch,
    type: "smoothstep",
    animated: true,
    style: { stroke: "var(--color-accent)", strokeWidth: 2, opacity: 0.8 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-accent)" },
  };
}

function reactFlowEdgeToDomainEdge(e: Edge): DomainEdge {
  return {
    id: e.id,
    sourceNodeId: e.source,
    targetNodeId: e.target,
    conditionBranch: e.sourceHandle as "yes" | "no" | undefined,
  };
}

function getDefaultConfigForType(type: FlowNodeType): any {
  switch (type) {
    case "trigger":
      return { triggerType: "COMMENT_KEYWORD", keywords: ["قیمت", "خرید"], matchAnyWord: false, wholeWordMatch: true };
    case "send_dm":
      return { messageText: "سلام! لینک محصول خدمت شما ارسال شد:", buttons: [] };
    case "send_media":
      return { mediaType: "image", mediaUrl: "" };
    case "send_carousel":
      return {
        elements: [
          { title: "محصول ۱", subtitle: "توضیحات کوتاه", image_url: "", buttons: [{ type: "web_url", title: "خرید", url: "https://" }] }
        ]
      };
    case "quick_reply":
      return {
        messageText: "کدام بخش را می‌خواهید بررسی کنید؟",
        quickReplies: [
          { title: "کاتالوگ محصولات", payload: "catalog" },
          { title: "مشاوره رایگان", payload: "consulting" }
        ]
      };
    case "condition":
      return { ruleType: "HAS_TAG", tagName: "vip" };
    case "add_tag":
      return { tagName: "interested_lead" };
    case "remove_tag":
      return { tagName: "pending_lead" };
    case "enroll_drip":
      return { campaignId: "" };
    case "ai_reply":
      return { prompt: "به عنوان کارشناس فروش با مشتری صحبت کن و نیازسنجی انجام بده." };
    case "handover_to_human":
      return { reason: "درخواست اپراتور انسانی توسط مشتری" };
    case "collect_input":
      return { inputType: "email", promptMessage: "لطفا ایمیل خود را وارد کنید:" };
    case "webhook_action":
      return { webhookUrl: "https://hooks.zapier.com/...", httpMethod: "POST" };
    case "smart_delay":
      return { delayAmount: 5, delayUnit: "minutes" };
    default:
      return {};
  }
}


function FlowBuilderInner({
  initialGraph = DEFAULT_GRAPH,
  flowName = "فلوی جدید اتوماسیون",
  flowId,
  onSave,
}: FlowBuilderProps) {
  const [name, setName] = useState(flowName);
  const [isSaving, setIsSaving] = useState(false);
  const [testResults, setTestResults] = useState<FlowStepResult[] | null>(null);
  const [testMessage, setTestMessage] = useState("قیمت این محصول چنده؟");
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);

  // React Flow state
  const initialNodes = initialGraph.nodes.map(domainNodeToReactFlowNode);
  const initialEdges = initialGraph.edges.map(domainEdgeToReactFlowEdge);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Sync selectedNodeId with ReactFlow selection when user clicks a node directly on canvas
  useEffect(() => {
    const selected = nodes.find((n) => n.selected);
    if (selected && selected.id !== selectedNodeId) {
      setSelectedNodeId(selected.id);
    }
  }, [nodes, selectedNodeId]);

  const nodeTypes = useMemo(() => ({ custom: BaseCustomNode }), []);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: true,
            style: { stroke: "var(--color-accent)", strokeWidth: 2, opacity: 0.8 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-accent)" },
          },
          eds
        )
      ),
    [setEdges]
  );

  // ── Add node from library ──
  const handleAddNode = (type: FlowNodeType) => {
    const newNodeId = `node_${type}_${Date.now()}`;
    const domainNode: DomainNode = {
      id: newNodeId,
      type,
      title: NODE_TYPE_DEFAULT_TITLES[type] || "نود جدید",
      position: { x: 250, y: 150 }, // spawn in middle
      data: {
        type,
        config: getDefaultConfigForType(type),
      },
    };

    const rfNode = domainNodeToReactFlowNode(domainNode, nodes.length);
    rfNode.selected = true;

    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), rfNode]);
    setSelectedNodeId(newNodeId);
  };

  // ── Update node from inspector ──
  const handleUpdateNode = (updatedDomainNode: DomainNode) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === updatedDomainNode.id) {
          const updatedRfNode = domainNodeToReactFlowNode(
            updatedDomainNode,
            n.data.stepIndex as number
          );
          updatedRfNode.selected = true;
          return updatedRfNode;
        }
        return n;
      })
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (onSave) {
        const domainGraph: FlowGraph = {
          nodes: nodes.map(reactFlowNodeToDomainNode),
          edges: edges.map(reactFlowEdgeToDomainEdge),
        };
        await onSave(name, domainGraph);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunTest = async () => {
    const domainGraph: FlowGraph = {
      nodes: nodes.map(reactFlowNodeToDomainNode),
      edges: edges.map(reactFlowEdgeToDomainEdge),
    };
    const results = await executeFlowGraph(domainGraph, {
      workspaceId: "test_ws",
      instagramAccountId: "test_ig",
      userId: "user_test_123",
      username: "test_user",
      userMessage: testMessage,
      hasEmail: false,
      hasPhone: false,
    });
    setTestResults(results);
  };

  const selectedDomainNode = nodes.find((n) => n.id === selectedNodeId)
    ? reactFlowNodeToDomainNode(nodes.find((n) => n.id === selectedNodeId)!)
    : null;

  const formattedNodes = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      selected: n.id === selectedNodeId,
    }));
  }, [nodes, selectedNodeId]);

  return (
    <div className="flex h-full w-full flex-col bg-background font-sans select-none xyflow-wrapper overflow-hidden">
      {/* ── Top Controls Bar ── */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-panel px-4 sm:px-6 shrink-0 z-20 relative flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsLibraryOpen((prev) => !prev)}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors"
            title="نمایش / مخفی‌سازی کتابخانه نودها"
          >
            {isLibraryOpen ? "◀ کتابخانه" : "▶ کتابخانه"}
          </button>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1 text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:border-accent w-40 sm:w-64"
          />
          <span className="text-[11px] text-muted hidden sm:inline">
            ({nodes.length} نود ، {edges.length} اتصال)
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleRunTest}
            className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors shrink-0"
          >
            🧪 تست فلو
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors shrink-0"
          >
            {isSaving ? "در حال ذخیره..." : "ذخیره و انتشار فلو"}
          </button>
        </div>
      </header>

      {/* ── Main Canvas + Panels ── */}
      <div className="flex flex-1 overflow-hidden relative">
        <NodeLibrary
          onAddNode={handleAddNode}
          isOpen={isLibraryOpen}
          onToggle={() => setIsLibraryOpen((prev) => !prev)}
        />

        {/* ── React Flow Canvas ── */}
        <div className="flex-1 relative border-r border-border" dir="ltr">
          <ReactFlow
            nodes={formattedNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
            className="bg-zinc-950"
            colorMode="dark"
          >
            <Background color="#555" gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const t = n.data?.type;
                if (t === "trigger") return "#fbbf24";
                if (t === "send_dm") return "#60a5fa";
                if (t === "condition") return "#c084fc";
                return "#9ca3af";
              }}
            />
          </ReactFlow>
        </div>

        {/* ── Node Inspector Panel ── */}
        <div dir="rtl" className="h-full">
          <NodeInspector
            selectedNode={selectedDomainNode}
            allNodes={nodes.map(reactFlowNodeToDomainNode)}
            allEdges={edges}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onDeleteEdge={(edgeId) => setEdges((eds) => eds.filter((e) => e.id !== edgeId))}
            onClose={() => {
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
              setSelectedNodeId(null);
            }}
          />
        </div>
      </div>

      {/* ── Test Execution Simulation Drawer ── */}
      {testResults && (
        <div className="border-t border-border bg-panel px-4 py-3 max-h-64 overflow-y-auto flex flex-col gap-2 shrink-0 z-20 relative">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground">نتیجه شبیه‌سازی فلو:</h4>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground w-48"
                placeholder="پیام تست..."
              />
              <button
                type="button"
                onClick={handleRunTest}
                className="rounded bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
              >
                تست مجدد
              </button>
              <button
                type="button"
                onClick={() => setTestResults(null)}
                className="text-xs text-muted hover:text-foreground"
              >
                بستن
              </button>
            </div>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            {testResults.length === 0 ? (
              <p className="text-muted">⚠️ هیچ نودی متناسب با ورودی اجرا نشد. کلمات کلیدی Trigger را بررسی کنید.</p>
            ) : (
              testResults.map((res, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span className="text-muted shrink-0">
                    [{res.nodeType}]
                  </span>
                  <span className="text-foreground">{res.actionTaken}</span>
                  {res.dmMessageToSend && (
                    <span className="text-muted italic truncate max-w-[200px]">
                      «{res.dmMessageToSend.slice(0, 50)}...»
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FlowBuilder(props: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
