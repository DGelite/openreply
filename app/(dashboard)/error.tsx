"use client";

import React, { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error Boundary]:", error);
  }, [error]);

  const isChunkError =
    error.message?.includes("ChunkLoadError") ||
    error.message?.includes("Loading chunk") ||
    error.message?.includes("failed");

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="bg-panel border border-border p-8 rounded-2xl max-w-md w-full space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto text-xl">
          ⚠️
        </div>
        <h2 className="text-lg font-bold text-foreground">
          {isChunkError ? "بروزرسانی جدید برنامه" : "خطایی رخ داده است"}
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          {isChunkError
            ? "نسخه جدیدی از برنامه منتشر شده است. برای بارگیری آخرین تغییرات، لطفاً صفحه را بروزرسانی کنید."
            : "متأسفانه مشکلی در بارگذاری این صفحه به وجود آمده است."}
        </p>
        <div className="pt-2 flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => {
              if (isChunkError) {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="px-4 py-2 bg-accent text-accent-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            {isChunkError ? "بروزرسانی صفحه" : "تلاش مجدد"}
          </button>
        </div>
      </div>
    </div>
  );
}
