import express from 'express';

const app = express();
const PORT = process.env.PORT || 3002;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'AURA Backend is running!', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
});