# Agent Command: /build-check

> **Purpose:** Validate production build readiness by compiling the Next.js application, generating the Prisma client, and verifying static/dynamic page generation.

## Operational Workflow

When this command is invoked, the Agent MUST execute the production build pipeline:

```bash
npm run build
```
(which executes `prisma generate && next build --webpack`).

### Verification Criteria
1. **Prisma Generation:** Generates the typed client to `lib/generated/prisma` matching MariaDB/MySQL datasource without errors.
2. **Next.js Compilation:** Compiles all 61+ routes including App Router dynamic and static endpoints.
3. **Chunk Optimization:** Bundles client and server chunks within target budget.
4. **Standalone Output Readiness:** Validates that output conforms with Docker standalone runner expectations.

## Expected Output Format
The Agent must report:
- Total routes compiled (Static vs Server-rendered).
- Build time and chunk size overview.
- Confirmation of exit code 0.
