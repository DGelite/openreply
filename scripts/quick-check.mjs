/**
 * OpenReply - Cross-Platform Pre-Flight Readiness Inspector
 * Compatible with Windows, macOS, and Linux without bash dependency.
 *
 * Usage: node scripts/quick-check.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalIssues = 0;

function header(title) {
  console.log('\n================================================================');
  console.log(`  🛡️  ${title}`);
  console.log('================================================================');
}

function check(label, pass, detail = '', fix = '') {
  if (pass) {
    console.log(`  ✅ [PASS] ${label}${detail ? ` (${detail})` : ''}`);
  } else {
    console.log(`  ❌ [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
    if (fix) console.log(`     👉 Remedy: ${fix}`);
    totalIssues++;
  }
}

function warn(label, detail = '') {
  console.log(`  ⚠️  [WARN] ${label}${detail ? `: ${detail}` : ''}`);
}

header('OPENREPLY CROSS-PLATFORM PRE-FLIGHT AUDIT');

// 1. Node.js Runtime Check
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
check(
  'Node.js Version',
  nodeMajor >= 20,
  `v${process.versions.node} detected`,
  'Install Node.js 20 LTS or higher'
);

// 2. Critical Files Check
const criticalFiles = [
  'package.json',
  'Dockerfile',
  'docker-compose.yml',
  'prisma/schema.prisma',
  'deploy/quick-launch.sh',
  'deploy/init-db/01-init-schema.sql',
  'scripts/db-baseline.ts',
  'scripts/db-audit.ts',
];
for (const f of criticalFiles) {
  const exists = fs.existsSync(path.join(rootDir, f));
  check(`File: ${f}`, exists, '', `Ensure ${f} is present in repository`);
}

// 3. Environment Configuration Check
const envPath = path.join(rootDir, '.env');
const envExists = fs.existsSync(envPath);
check('.env Configuration File', envExists, '', 'Copy .env.example to .env and configure credentials');

if (envExists) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envMap = new Map();
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.substring(0, idx).trim();
      let v = trimmed.substring(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      envMap.set(k, v);
    }
  }

  const validateVar = (key, minLen = 1, critical = true) => {
    const val = envMap.get(key);
    if (!val) {
      if (critical) {
        check(`Env: ${key}`, false, 'Missing or empty', `Set ${key} in .env`);
      } else {
        warn(`Env: ${key}`, 'Optional variable not defined');
      }
    } else if (val.length < minLen) {
      check(`Env: ${key}`, false, `Value too short (${val.length} < ${minLen})`, `Provide strong value for ${key}`);
    } else {
      check(`Env: ${key}`, true, `Configured (${val.length} chars, masked)`);
    }
  };

  validateVar('DATABASE_URL', 15, true);
  validateVar('NEXTAUTH_SECRET', 16, true);
  validateVar('ENCRYPTION_KEY', 64, true);
  validateVar('CRON_SECRET', 16, true);
  validateVar('WEBHOOK_VERIFY_TOKEN', 8, true);
  validateVar('NEXTAUTH_URL', 10, true);
}

// 4. Docker CLI Tooling Check
try {
  const dockerVer = execSync('docker --version', { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf-8' }).trim();
  check('Docker CLI', true, dockerVer);
} catch {
  warn('Docker CLI', 'Not found in PATH or not executable on this machine');
}

try {
  const composeVer = execSync('docker compose version', { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf-8' }).trim();
  check('Docker Compose Plugin', true, composeVer);
} catch {
  warn('Docker Compose', 'docker compose command not available');
}

// 5. Prisma Schema Validation Check
try {
  execSync('npx prisma validate', { cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] });
  check('Prisma Schema Validation', true, 'prisma/schema.prisma is 100% valid');
} catch (e) {
  check('Prisma Schema Validation', false, 'Prisma validation failed', 'Run npx prisma validate to inspect errors');
}

header('AUDIT SUMMARY');
if (totalIssues === 0) {
  console.log('  🎉 All pre-flight checks PASSED! Repository is ready for launch.\n');
  process.exit(0);
} else {
  console.log(`  ⚠️  Found ${totalIssues} issue(s) that should be resolved before launch.\n`);
  process.exit(1);
}
