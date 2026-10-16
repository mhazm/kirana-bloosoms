function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function write(level, args) {
  const method = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
  console[method](`[${timestamp()}] [${level}]`, ...args);
}

export const logger = {
  info: (...args) => write('INFO', args),
  warn: (...args) => write('WARN', args),
  error: (...args) => write('ERROR', args),
};
