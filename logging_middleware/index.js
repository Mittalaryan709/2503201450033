const express = require('express');
const { requestLogger } = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Attach the custom logging middleware
app.use(requestLogger({ logBody: true }));

// ----- Sample routes for demonstration -----

app.get('/', (req, res) => {
  res.json({ message: 'Server is running', requestId: req.requestId });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/echo', (req, res) => {
  res.status(200).json({ received: req.body, requestId: req.requestId });
});

app.get('/error-demo', (req, res) => {
  res.status(500).json({ error: 'Intentional error for logging demo' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Logging middleware demo running on http://localhost:${PORT}`);
});

module.exports = app;
