const sensitiveKeyPattern = /(authorization|token|secret|privatekey|private_key|signature|documentbase64|password)/i;

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    sensitiveKeyPattern.test(key) ? '[redacted]' : redact(item)
  ]));
}

function write(level, message, fields = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...redact(fields)
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else console.log(line);
}

export function logInfo(message, fields = {}) {
  write('info', message, fields);
}

export function logError(message, fields = {}) {
  write('error', message, fields);
}
