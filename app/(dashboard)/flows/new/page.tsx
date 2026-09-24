"use client";

import { useRouter } from "next/navigation";
import FlowBuilder from "@/components/flow-builder/flow-builder";
import { FlowGraph } from "@/lib/flow/types";

export default function NewFlowPage() {
  const router = useRouter();

  const handleSave = async (name: string, graph: FlowGraph) => {
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, graph }),
      });

      if (res.ok) {
        router.push("/flows");
      } else {
        alert("خطا در ذخیره فلو. لطفاً دوباره تلاش کنید.");
      }
    } catch (err) {
      console.error("Failed to save flow:", err);
      alert("خطا در برقراری ارتباط با سرور.");
    }
  };

  return <FlowBuilder onSave={handleSave} />;
}
