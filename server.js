// server.js
const express = require('express');
const path = require('path');
const { runScraper } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/scan', async (req, res) => {
  const { brands } = req.body || {};
  if (!Array.isArray(brands) || !brands.length) {
    return res.status(400).json({ error: 'Marka listesi gerekli' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ type: 'start', brands });

  try {
    const { results, summary } = await runScraper(brands, send);
    send({ type: 'done', results, summary });
  } catch (err) {
    send({ type: 'fatal', message: err.message });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Panel hazır: http://localhost:${PORT}`);
});