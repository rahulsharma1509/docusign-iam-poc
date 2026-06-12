import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const roots = ['api', 'public', 'scripts', 'server', 'tests'];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(filePath, files);
    else if (entry.isFile() && filePath.endsWith('.js')) files.push(filePath);
  }

  return files;
}

const files = roots.flatMap((item) => walk(path.join(root, item)));
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push({ file: path.relative(root, file), output: result.stderr || result.stdout });
  }
}

if (failures.length) {
  console.error('Syntax check failed.');
  for (const failure of failures) {
    console.error(`\n${failure.file}\n${failure.output}`);
  }
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
