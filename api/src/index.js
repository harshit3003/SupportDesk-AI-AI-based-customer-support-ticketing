import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import ticketRoutes from './routes/tickets.js';
import analyticsRoutes from './routes/analytics.js';
import { startSlaSweeper } from './services/sla.js';

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN || true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message });
});

const PORT = process.env.PORT || 4000;
await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/support');
startSlaSweeper();
app.listen(PORT, () => console.log(`API on :${PORT}`));
