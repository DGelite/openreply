# Agent Command: /test

> **Purpose:** Execute full test suite, TypeScript compiler validation, and lint checks with clear reporting of exit codes.

## Operational Workflow

When this command is invoked, the Agent MUST execute the following suites and report exit codes:

### 1. TypeScript Compiler Check
```bash
npm run typecheck
```
- Command: `tsc --noEmit`
- Target: 0 errors. Never ignore TypeScript errors.

### 2. Vitest Test Suite (Unit & Integration)
```bash
npx vitest run
```
- Runs all 10 test suites in `__tests__/`:
  - `persian-keyword-matcher.test.ts`
  - `php-booking-bridge.test.ts`
  - `meta-safety-policy.test.ts`
  - `enterprise.test.ts`
  - `multi-worker-safety.test.ts`
  - `ai-agent-advanced.test.ts`
  - `architectural-fixes.test.ts`
  - `iranian-features.test.ts`
  - `flow-builder.test.ts`
  - `crm-drip-integration.test.ts`
- Expected: 100% passing tests (112+ tests).

### 3. ESLint Code Quality
```bash
npm run lint
```
- Inspect output and report any warnings or errors.

## Failure Handling
- If any test fails, do NOT weaken or skip the test. Identify the root cause and fix the regression.
- Report exact failing test names and assertion outputs.
