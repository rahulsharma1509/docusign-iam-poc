import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error(result.stderr || 'Unable to list tracked files.');
  process.exit(result.status || 1);
}

const files = result.stdout
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => file !== 'scripts/secret-scan.js');

const patterns = [
  { name: 'private key block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'GitHub token', regex: /gh[pousr]_[A-Za-z0-9_]{30,}/ },
  { name: 'Slack token', regex: /xox[baprs]-[A-Za-z0-9-]{20,}/ },
  { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/ },
  {
    name: 'DocuSign env value',
    regex: /DOCUSIGN_(INTEGRATION_KEY|USER_ID|ACCOUNT_ID|WEBHOOK_SECRET)=["']?[A-Za-z0-9_-]{12,}/
  }
];

const findings = [];

for (const file of files) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        findings.push({ file, line: index + 1, pattern: pattern.name });
      }
    }
  });
}

if (findings.length) {
  console.error('Potential secrets found in tracked files:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} (${finding.pattern})`);
  }
  process.exit(1);
}

console.log(`Secret scan passed for ${files.length} repository files.`);
