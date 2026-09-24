"use client";

import { Handle, Position } from "@xyflow/react";
import { FlowNodeType } from "@/lib/flow/types";

const NODE_TYPE_ICONS: Record<FlowNodeType, string> = {
  trigger: "⚡",
  send_dm: "💬",
  send_media: "🎬",
  send_carousel: "🎴",
  quick_reply: "🔘",
  condition: "🔀",
  add_tag: "🏷️",
  remove_tag: "✂️",
  enroll_drip: "💧",
  ai_reply: "🤖",
  handover_to_human: "👤",
  collect_input: "📝",
  webhook_action: "🚀",
  smart_delay: "⏱️",
};

const NODE_TYPE_COLORS: Record<FlowNodeType, string> = {
  trigger: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  send_dm: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  send_media: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
  send_carousel: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10",
  quick_reply: "text-teal-400 border-teal-500/30 bg-teal-500/10",
  condition: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  add_tag: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  remove_tag: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  enroll_drip: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  ai_reply: "text-pink-400 border-pink-500/30 bg-pink-500/10",
  handover_to_human: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  collect_input: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  webhook_action: "text-rose-400 border-rose-500/30 bg-rose-500/10",
  smart_delay: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
};

export function BaseCustomNode({ data, selected }: any) {
  const type = data.type as FlowNodeType;
  const colorClass = NODE_TYPE_COLORS[type] || "text-zinc-400 border-zinc-500/30 bg-zinc-500/10";
  
  return (
    <div className={`relative w-[230px] rounded-xl border bg-panel shadow-xl transition-all ${selected ? "border-accent ring-2 ring-accent/30 scale-[1.02]" : "border-border hover:border-zinc-500"}`}>
      {/* Target Handle (Input) - Triggers don't have inputs */}
      {type !== "trigger" && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className="w-3 h-3 bg-zinc-300 border-2 border-zinc-700 hover:scale-125 transition-transform" 
        />
      )}

      {/* Node Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 rounded-t-xl border-b border-border bg-black/20">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{NODE_TYPE_ICONS[type] || "⚡"}</span>
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${colorClass}`}>
            {type}
          </span>
        </div>
        <div className="flex items-center gap-1">
           <div className="w-5 h-5 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-[10px] font-bold text-accent">
            {data.stepIndex !== undefined ? data.stepIndex + 1 : "#"}
          </div>
        </div>
      </div>

      {/* Node Body */}
      <div className="px-3 py-3 flex flex-col gap-1.5">
        <h4 className="text-xs font-semibold text-foreground truncate">
          {data.title || "عنوان نود"}
        </h4>
        <p className="text-[11px] text-muted line-clamp-2 leading-snug">
          {data.previewText || "تنظیمات وارد نشده است..."}
        </p>

        {/* Quick visual badges for rich nodes */}
        {type === "quick_reply" && Array.isArray(data.config?.quickReplies) && data.config.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.config.quickReplies.slice(0, 3).map((qr: any, idx: number) => (
              <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
                {qr.title}
              </span>
            ))}
          </div>
        )}

        {type === "send_carousel" && Array.isArray(data.config?.elements) && (
          <div className="text-[10px] text-fuchsia-400 font-mono mt-0.5">
            🎴 {data.config.elements.length} کارت اسلایدر
          </div>
        )}

        {type === "add_tag" && data.config?.tagName && (
          <div className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 w-fit">
            🏷️ {data.config.tagName}
          </div>
        )}

        {type === "enroll_drip" && data.config?.campaignId && (
          <div className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 w-fit">
            💧 ورود به کمپین
          </div>
        )}
      </div>

      {/* Source Handles (Outputs) */}
      {type === "condition" ? (
        <>
          <Handle 
            type="source" 
            position={Position.Right} 
            id="yes" 
            className="w-3 h-3 bg-emerald-400 border-2 border-emerald-900 !top-1/3 hover:scale-125 transition-transform" 
          />
          <Handle 
            type="source" 
            position={Position.Right} 
            id="no" 
            className="w-3 h-3 bg-rose-400 border-2 border-rose-900 !top-2/3 hover:scale-125 transition-transform" 
          />
          <span className="absolute right-[-24px] top-[calc(33%-6px)] text-[9px] text-emerald-400 font-bold">بله</span>
          <span className="absolute right-[-24px] top-[calc(66%-6px)] text-[9px] text-rose-400 font-bold">خیر</span>
        </>
      ) : (
        <Handle 
          type="source" 
          position={Position.Right} 
          className="w-3 h-3 bg-accent border-2 border-accent-foreground hover:scale-125 transition-transform" 
        />
      )}
    </div>
  );
}
