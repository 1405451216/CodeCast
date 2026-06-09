// scripts/audit-backend-usage.mjs
//
// Audit backend API usage across the frontend codebase.
// Reads Go binding type definitions and checks which methods are imported/used.
//
// Usage: node scripts/audit-backend-usage.mjs

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(import.meta.dirname, '..');
const BINDINGS_FILE = join(ROOT, 'wailsjs', 'go', 'main', 'App.d.ts');
const SRC_DIR = join(ROOT, 'src', 'v2');

// Extract method names from App.d.ts
function extractMethods() {
  const content = readFileSync(BINDINGS_FILE, 'utf-8');
  const methods = [];
  const regex = /export\s+function\s+(\w+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    methods.push(match[1]);
  }
  return methods;
}

// Recursively find all .ts/.tsx files
function findFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...findFiles(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

// Check which files reference each method
function analyzeUsage(methods) {
  const files = findFiles(SRC_DIR);
  const usage = {};

  for (const method of methods) {
    usage[method] = { count: 0, files: [] };
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes(method)) {
        usage[method].count++;
        usage[method].files.push(relative(ROOT, file));
      }
    }
  }

  return usage;
}

// Group methods by namespace
function groupByNamespace(methods) {
  const groups = {};
  for (const method of methods) {
    // Guess namespace from method name prefix
    const prefix = method.replace(/^Get|Set|Add|Remove|Update|Toggle|Check|Create|Delete|Load|Save|Run|Cancel|List|Refresh|Clear|Batch|Archive|Unarchive|Send|Open|Close|Fix|Ingest|Export|Pause|Resume|Dispatch|Resolve|Confirm|Analyze|Test|Silent|Download|Reset|Rotate|Broadcast|Extract|Start|Stop|Reset/, '');
    const ns = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    if (!groups[ns]) groups[ns] = [];
    groups[ns].push(method);
  }
  return groups;
}

// Main
const methods = extractMethods();
const usage = analyzeUsage(methods);

console.log('# Backend API Usage Report\n');
console.log(`Generated: ${new Date().toISOString()}\n`);
console.log(`Total backend methods: ${methods.length}\n`);

// Summary table
console.log('## Summary\n');
console.log('| Metric | Count |');
console.log('|--------|-------|');

const usedMethods = methods.filter(m => usage[m].count > 0);
const testOnlyMethods = methods.filter(m => {
  const files = usage[m].files;
  return files.length > 0 && files.every(f => f.includes('__tests__'));
});
const unusedMethods = methods.filter(m => usage[m].count === 0);

console.log(`| Total methods | ${methods.length} |`);
console.log(`| Used in UI/slice | ${usedMethods.length - testOnlyMethods.length} |`);
console.log(`| Test-only usage | ${testOnlyMethods.length} |`);
console.log(`| Unused | ${unusedMethods.length} |`);
console.log('');

// Detailed table
console.log('## Method Usage\n');
console.log('| Method | Usage Count | Files |');
console.log('|--------|-------------|-------|');

for (const method of methods) {
  const u = usage[method];
  const files = u.files.map(f => f.split('/').pop()).join(', ');
  const status = u.count === 0 ? '❌' : u.files.every(f => f.includes('__tests__')) ? '⚠️' : '✅';
  console.log(`| ${method} | ${u.count} ${status} | ${files || '—'} |`);
}

// Unused methods
if (unusedMethods.length > 0) {
  console.log('\n## Unused Methods\n');
  console.log('These methods are not referenced anywhere in the frontend:\n');
  for (const m of unusedMethods) {
    console.log(`- ${m}`);
  }
}

// Test-only methods
if (testOnlyMethods.length > 0) {
  console.log('\n## Test-Only Methods\n');
  console.log('These methods are only referenced in test files:\n');
  for (const m of testOnlyMethods) {
    console.log(`- ${m}`);
  }
}
