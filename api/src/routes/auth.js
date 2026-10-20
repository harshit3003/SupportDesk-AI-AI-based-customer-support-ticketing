import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models.js';
import { SECRET, auth, wrap } from '../middleware.js';

const r = Router();

r.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
}));

r.post('/agents', auth(['admin']), wrap(async (req, res) => {
  const { name, email, password, skills = [], role = 'agent' } = req.body;
  const user = await User.create({ name, email, role, skills, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ id: user._id });
}));

r.get('/agents', auth(), wrap(async (_req, res) => {
  res.json(await User.find({ role: 'agent' }).select('name email skills active maxOpen'));
}));

export default r;
