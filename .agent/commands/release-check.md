# Agent Command: /release-check

> **Purpose:** Comprehensive pre-release inspection to ensure Git cleanliness, build integrity, test passage, and zero leaked secrets before committing or tagging a release.

## Operational Workflow

When this command is invoked, the Agent MUST execute:

### 1. Git Status & Whitespace Audit
```bash
git status --short
git diff --check
```
- Verify no merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
- Verify no trailing whitespace errors.
- Verify no untracked secrets, dumps, or zip archives are staged.

### 2. Secret Leak Inspection
Scan the working tree to ensure no credentials are present in non-ignored files:
- Inspect `.gitignore` for `.env*`, `*.pem`, `*.key`, `backups/`.
- Ensure `.env.example` contains only template placeholders.
- Verify `git check-ignore .env` confirms `.env` is ignored.

### 3. Full Production Build Validation
```bash
npm run build
```
- Prisma Client generation to `lib/generated/prisma`.
- Next.js webpack production compilation.
- Page data collection and static route optimization.
- Must exit with code 0.

### 4. Full Test Suite Validation
```bash
npm run test
```
- Vitest 10 test suites, 112+ tests must all pass.

### 5. Final Report
Report whether the branch is Git-ready for safe commit and release. **DO NOT run `git commit` or `git push` without explicit user instruction.**
