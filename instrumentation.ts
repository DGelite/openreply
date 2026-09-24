export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startInternalWorker } = await import("./lib/queue/worker-loop");
      startInternalWorker();
      console.log("> Instagram Queue Worker started successfully via instrumentation");
    } catch (err) {
      console.error("> Failed to start Instagram Queue Worker:", err);
    }
  }
}


