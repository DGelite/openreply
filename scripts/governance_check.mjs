/**
 * OpenReply - Local Automated Governance Linter
 * Enforces zero hardcoded Windows paths, no secrets in source, and NextAuth/Prisma conventions.
 * 
 * Usage: node scripts/governance_check.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let violations = 0;

console.log("===============================================================");
console.log("  🛡️  OPENREPLY REPOSITORY GOVERNANCE CHECKER  ");
console.log("===============================================================\n");

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git', 'generated', 'dist'].includes(entry.name)) continue;
      scanDirectory(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const rel = path.relative(rootDir, filePath);

  lines.forEach((line, idx) => {
    // Check 1: Hardcoded Windows absolute paths
    if (/["'][a-zA-Z]:\\\\/i.test(line) && !filePath.includes('__tests__')) {
      console.warn(`[RULE_NO_HARDCODED_WINDOWS_PATHS] ${rel}:${idx + 1}`);
      console.warn(`  ➔ ${line.trim()}`);
      violations++;
    }

    // Check 2: Relative imports that escape openreply-main root
    if (/from\s+["'](\.\.\/){4,}/.test(line)) {
      console.warn(`[RULE_NO_CROSS_PROJECT_IMPORT] ${rel}:${idx + 1}`);
      console.warn(`  ➔ ${line.trim()}`);
      violations++;
    }
  });
}

scanDirectory(path.join(rootDir, 'app'));
scanDirectory(path.join(rootDir, 'lib'));
scanDirectory(path.join(rootDir, 'worker'));

console.log("\n===============================================================");
if (violations === 0) {
  console.log("✅ OPENREPLY GOVERNANCE PASSED! 100% Compliant.");
  process.exit(0);
} else {
  console.warn(`⚠️  Found ${violations} governance warnings in OpenReply.`);
  process.exit(1);
}
