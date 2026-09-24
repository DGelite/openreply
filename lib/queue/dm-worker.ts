import { startInternalWorker } from "./worker-loop";

export * from "./worker-loop";

export function createDMWorker() {
  return startInternalWorker();
}
