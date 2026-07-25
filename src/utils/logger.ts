// Serverless-safe structured logger architecture
// Bypasses multi-threaded transport crash issues (pino/sonic-boom/thread-stream) in @vercel/node single-file lambda packaging
export const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log('[DEBUG]', ...args);
    }
  },
};
