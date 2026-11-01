export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Allow disabling embedded worker when running a dedicated background worker process on VPS
    if (
      process.env.DISABLE_INTERNAL_WORKER === "true" ||
      process.env.WORKER_STANDALONE === "true"
    ) {
      console.log(
        "> Internal worker disabled in web process (WORKER_STANDALONE / DISABLE_INTERNAL_WORKER is set)"
      );
      return;
    }

    try {
      const { startInternalWorker } = await import("./lib/queue/worker-loop");
      startInternalWorker();
      console.log("> Instagram Queue Worker started successfully via instrumentation");
    } catch (err) {
      console.error("> Failed to start Instagram Queue Worker:", err);
    }
  }
}
