import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models.js';
import { SECRET, auth, wrap } from '../middleware.js';

const r = Router();

r.post('/login', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = email ? await User.findOne({ email }) : null;
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
}));

r.post('/agents', auth(['admin']), wrap(async (req, res) => {
  const { name, email, password, skills = [], role = 'agent' } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (!['admin', 'agent'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  const user = await User.create({
    name, email: String(email), role,
    skills: Array.isArray(skills) ? skills.map(String) : [],
    passwordHash: await bcrypt.hash(String(password), 10),
  });
  res.status(201).json({ id: user._id });
}));

r.get('/agents', auth(), wrap(async (_req, res) => {
  res.json(await User.find({ role: 'agent' }).select('name email skills active maxOpen'));
}));

export default r;
