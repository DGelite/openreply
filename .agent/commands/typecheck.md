# Agent Command: /typecheck

> **Purpose:** Run full TypeScript strict type checking across the entire OpenReply codebase without emitting build artifacts.

## Operational Workflow

When this command is invoked, the Agent MUST execute:

```bash
npm run typecheck
```
(which maps to `tsc --noEmit`).

### Verification Criteria
- TypeScript compiler runs with project configuration (`tsconfig.json`).
- Validates all Next.js App Router pages, route handlers, server actions, React components, worker scripts, and utility modules.
- Zero TypeScript syntax, type mismatch, or missing symbol errors (Exit Code 0).
- Memory-safe execution without stack overflow or V8 out-of-memory.

## Expected Output Format
The Agent must deliver:
- TypeScript version in use.
- Number of files checked.
- Explicit confirmation of zero errors or full diagnostic listing of type errors.
