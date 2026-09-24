"use client";

import { useEffect } from "react";

/**
 * Handles Next.js ChunkLoadError automatically.
 * When a new deployment happens on the server, the browser may request old chunk hashes.
 * This component intercepts ChunkLoadError and reloads the page to fetch fresh build assets.
 */
export default function ChunkErrorHandler() {
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const error = "reason" in event ? event.reason : event.error;
      const errorMessage = error?.message || error?.toString() || "";

      if (
        errorMessage.includes("ChunkLoadError") ||
        errorMessage.includes("Loading chunk") ||
        errorMessage.includes("failed to fetch dynamically imported module")
      ) {
        console.warn("[ChunkErrorHandler] Chunk load error detected. Reloading for fresh assets...");
        
        // Prevent infinite reload loop if server is down
        const lastReload = sessionStorage.getItem("chunk_reload_timestamp");
        const now = Date.now();

        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem("chunk_reload_timestamp", now.toString());
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", handleChunkError);
    window.addEventListener("unhandledrejection", handleChunkError);

    return () => {
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("unhandledrejection", handleChunkError);
    };
  }, []);

  return null;
}
