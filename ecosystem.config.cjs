/**
 * OpenReply PM2 Ecosystem Configuration for Production VPS
 *
 * Resource Budgeting & Connection Limits:
 * - Recommended Hardware: 2 to 4 vCPUs, 4GB RAM
 * - Web Concurrency: 2 instances (Cluster mode) to avoid database connection pool exhaustion
 * - Worker Concurrency: 1 dedicated instance (Fork mode)
 * - Database Connection Budget:
 *     2 web instances * 5 connections = 10 connections
 *     1 worker instance * 5 connections = 5 connections
 *     Total = 15 connections (Safely within MariaDB default max_connections=151)
 * - Memory Watchdog: 650MB auto-restart per web worker to prevent V8 memory accumulation
 */

module.exports = {
  apps: [
    {
      name: "openreply-web",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: process.env.WEB_CONCURRENCY ? parseInt(process.env.WEB_CONCURRENCY, 10) : 2,
      exec_mode: "cluster",
      max_memory_restart: "650M",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        WORKER_STANDALONE: "true",
        DISABLE_INTERNAL_WORKER: "true",
      },
    },
    {
      name: "openreply-worker",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "worker/dm-worker.ts",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      kill_timeout: 8000,
      exp_backoff_restart_delay: 1000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
