"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import FlowBuilder from "@/components/flow-builder/flow-builder";
import { FlowGraph } from "@/lib/flow/types";

export default function EditFlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [flow, setFlow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/flows/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.flow) setFlow(data.flow);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (name: string, graph: FlowGraph) => {
    try {
      const res = await fetch(`/api/flows/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, graph }),
      });

      if (res.ok) {
        router.push("/flows");
      } else {
        alert("خطا در به‌روزرسانی فلو.");
      }
    } catch (err) {
      console.error("Failed to update flow:", err);
      alert("خطا در ارتباط با سرور.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-muted">
        در حال بارگذاری فلو...
      </div>
    );
  }

  // Restore the saved graph if available, otherwise fall back to default
  const savedGraph: FlowGraph | undefined =
    flow?.flowGraph && typeof flow.flowGraph === "object"
      ? (flow.flowGraph as FlowGraph)
      : undefined;

  return (
    <FlowBuilder
      flowId={id}
      flowName={flow?.name || "ویرایش فلو"}
      initialGraph={savedGraph}
      onSave={handleSave}
    />
  );
}
