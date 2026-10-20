import { Router } from 'express';
import { Ticket, CATEGORIES, PRIORITIES, STATUSES } from '../models.js';
import { auth, wrap } from '../middleware.js';
import { classify } from '../services/ml.js';
import { pickAgent } from '../services/routing.js';
import { slaFor, isBreached } from '../services/sla.js';

const r = Router();

// Public: customer submits a ticket -> classify -> route -> start SLA clock
r.post('/public', wrap(async (req, res) => {
  const { subject, body, name, email } = req.body;
  if (!subject || !body || !email) return res.status(400).json({ error: 'subject, body and email are required' });
  const ai = await classify(subject, body);
  const assignee = await pickAgent(ai.category);
  const t = await Ticket.create({
    subject, body, customer: { name, email },
    category: ai.category, priority: ai.priority, assignee, ai,
    sla: slaFor(ai.priority), messages: [{ from: 'customer', body }],
  });
  res.status(201).json({ id: t._id, category: t.category, priority: t.priority });
}));

// Public: customer satisfaction rating (must match ticket email, ticket must be resolved)
r.post('/:id/csat', wrap(async (req, res) => {
  const { email, score, comment } = req.body;
  const t = await Ticket.findById(req.params.id);
  if (!t || t.customer.email.toLowerCase() !== String(email || '').toLowerCase()) return res.status(404).json({ error: 'Ticket not found' });
  if (!['resolved', 'closed'].includes(t.status)) return res.status(400).json({ error: 'Ticket is not resolved yet' });
  if (!(score >= 1 && score <= 5)) return res.status(400).json({ error: 'score must be 1-5' });
  t.csat = { score, comment, at: new Date() };
  await t.save();
  res.json({ ok: true });
}));

r.use(auth());

r.get('/', wrap(async (req, res) => {
  const { status, category, priority, mine, breached } = req.query;
  const q = {};
  if (status) q.status = status;
  if (category) q.category = category;
  if (priority) q.priority = priority;
  if (mine === 'true') q.assignee = req.user.id;
  if (breached === 'true') q['sla.breached'] = true;
  res.json(await Ticket.find(q).sort({ createdAt: -1 }).limit(200).populate('assignee', 'name'));
}));

r.get('/:id', wrap(async (req, res) => {
  const t = await Ticket.findById(req.params.id).populate('assignee', 'name');
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
}));

r.post('/:id/reply', wrap(async (req, res) => {
  const t = await Ticket.findById(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  t.messages.push({ from: 'agent', authorId: req.user.id, body: req.body.body });
  if (!t.sla.firstRespondedAt) t.sla.firstRespondedAt = new Date();
  if (!t.assignee) t.assignee = req.user.id;
  if (t.status === 'open') t.status = 'pending';
  t.sla.breached = t.sla.breached || isBreached(t);
  await t.save();
  res.json(t);
}));

r.patch('/:id', wrap(async (req, res) => {
  const t = await Ticket.findById(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  const { status, priority, category, assignee } = req.body;
  if (status && STATUSES.includes(status)) {
    t.status = status;
    if (['resolved', 'closed'].includes(status) && !t.sla.resolvedAt) t.sla.resolvedAt = new Date();
    if (status === 'open') t.sla.resolvedAt = null;
  }
  if (priority && PRIORITIES.includes(priority)) t.priority = priority;
  if (category && CATEGORIES.includes(category)) {
    if (category !== t.category) t.ai.correctedCategory = category; // feedback loop for retraining
    t.category = category;
  }
  if (assignee !== undefined) t.assignee = assignee || null;
  t.sla.breached = t.sla.breached || isBreached(t);
  await t.save();
  res.json(t);
}));

export default r;
