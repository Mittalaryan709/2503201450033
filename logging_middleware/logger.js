const { v4: uuidv4 } = require('uuid');

// Colour codes for terminal output based on HTTP status range
const COLOURS = {
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  reset:  '\x1b[0m',
};

function pickColour(statusCode) {
  if (statusCode >= 500) return COLOURS.red;
  if (statusCode >= 400) return COLOURS.yellow;
  if (statusCode >= 300) return COLOURS.cyan;
  if (statusCode >= 200) return COLOURS.green;
  return COLOURS.reset;
}

function humanDuration(milliseconds) {
  return milliseconds < 1000
    ? `${milliseconds}ms`
    : `${(milliseconds / 1000).toFixed(2)}s`;
}

/**
 * requestLogger middleware
 *
 * Tags each request with a UUID, records when it started, and writes a
 * one-line summary to the console once the response has finished.
 *
 * Options:
 *   logBody    {boolean}  Print request body alongside the log line (default: false)
 *   logHeaders {boolean}  Print request headers (default: false)
 *   writer     {Function} Swap out console.log for a custom sink (default: console.log)
 */
function requestLogger(opts = {}) {
  const logBody    = opts.logBody    ?? false;
  const logHeaders = opts.logHeaders ?? false;
  const writer     = opts.writer     ?? console.log;

  return function (req, res, next) {
    const reqId     = uuidv4();
    const startTime = Date.now();

    req.requestId = reqId;
    res.setHeader('X-Request-Id', reqId);

    // Intercept res.end so we can log after the response goes out
    const originalEnd = res.end.bind(res);

    res.end = function (...args) {
      const elapsed = Date.now() - startTime;
      const colour  = pickColour(res.statusCode);
      const ts      = new Date().toISOString();

      const line = `${colour}[${ts}]${COLOURS.reset} ${req.method} ${req.originalUrl || req.url}`
        + ` → ${colour}${res.statusCode}${COLOURS.reset}`
        + ` (${humanDuration(elapsed)}) id=${reqId}`;

      writer(line);

      if (logHeaders) writer('  headers:', JSON.stringify(req.headers));
      if (logBody && req.body) writer('  body:', JSON.stringify(req.body));

      if (process.env.LOG_JSON === 'true') {
        writer(JSON.stringify({
          requestId: reqId,
          method: req.method,
          path: req.originalUrl || req.url,
          status: res.statusCode,
          durationMs: elapsed,
          ip: req.ip || req.socket?.remoteAddress,
          timestamp: ts,
        }));
      }

      return originalEnd(...args);
    };

    next();
  };
}

module.exports = { requestLogger };
