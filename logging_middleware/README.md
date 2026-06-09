# Logging Middleware

A lightweight HTTP request/response logger for Express. Each incoming request gets a unique `X-Request-Id` header, and every response is logged with method, path, status code, and duration.

## Setup

```bash
cd logging_middleware
npm install
npm start        # production
npm run dev      # with nodemon auto-restart
```

## Usage

```js
const { requestLogger } = require('./logger');
app.use(requestLogger({ logBody: true, logHeaders: false }));
```

### Options

| Option       | Type     | Default       | Description                          |
|--------------|----------|---------------|--------------------------------------|
| `logBody`    | boolean  | `false`       | Include request body in log output   |
| `logHeaders` | boolean  | `false`       | Include request headers in log output|
| `writer`     | Function | `console.log` | Custom output function               |

### JSON mode

Set `LOG_JSON=true` in your environment to emit each log entry as structured JSON (useful with log aggregators like Datadog / CloudWatch).

```bash
LOG_JSON=true node index.js
```

## Sample Output

```
[2026-06-09T10:22:01.123Z] GET /health → 200 (3ms) [id:a1b2c3d4-...]
[2026-06-09T10:22:05.456Z] POST /echo → 200 (8ms) [id:e5f6g7h8-...]
[2026-06-09T10:22:09.789Z] GET /missing → 404 (2ms) [id:i9j0k1l2-...]
```
