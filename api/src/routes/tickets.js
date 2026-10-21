import { Router } from 'express';
import mongoose from 'mongoose';
import { Ticket, User, CATEGORIES, PRIORITIES, STATUSES } from '../models.js';
import { auth, wrap } from '../middleware.js';
import { classify } from '../services/ml.js';
import { pickAgent } from '../services/routing.js';
import { slaFor, isBreached } from '../services/sla.js';

const r = Router();

// Agents may only touch their own tickets or ones still in the unassigned queue.
const canAccess = (t, user) => {
  if (user.role === 'admin') return true;
  const owner = t.assignee?._id || t.assignee;
  return !owner || String(owner) === String(user.id);
};

// Public: customer submits a ticket -> classify -> route -> start SLA clock
r.post('/public', wrap(async (req, res) => {
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  const email = String(req.body?.email || '').trim();
  const name = String(req.body?.name || '').trim();
  if (!subject || !body || !email) return res.status(400).json({ error: 'subject, body and email are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'a valid email is required' });
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
  const { email, comment } = req.body || {};
  const score = Number(req.body?.score);
  const t = await Ticket.findById(req.params.id);
  if (!t || t.customer.email.toLowerCase() !== String(email || '').trim().toLowerCase()) return res.status(404).json({ error: 'Ticket not found' });
  if (!['resolved', 'closed'].includes(t.status)) return res.status(400).json({ error: 'Ticket is not resolved yet' });
  if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: 'score must be an integer from 1 to 5' });
  if (t.csat?.score) return res.status(409).json({ error: 'This ticket has already been rated' });
  t.csat = { score, comment: comment ? String(comment).slice(0, 2000) : undefined, at: new Date() };
  await t.save();
  res.json({ ok: true });
}));

r.use(auth());

r.get('/', wrap(async (req, res) => {
  const { status, category, priority, mine, breached } = req.query;
  const q = {};
  if (typeof status === 'string' && STATUSES.includes(status)) q.status = status;
  if (typeof category === 'string' && CATEGORIES.includes(category)) q.category = category;
  if (typeof priority === 'string' && PRIORITIES.includes(priority)) q.priority = priority;
  if (mine === 'true') q.assignee = req.user.id;
  if (breached === 'true') q['sla.breached'] = true;
  if (req.user.role !== 'admin' && mine !== 'true') q.$or = [{ assignee: req.user.id }, { assignee: null }];
  res.json(await Ticket.find(q).sort({ createdAt: -1 }).limit(200).populate('assignee', 'name'));
}));

r.get('/:id', wrap(async (req, res) => {
  const t = await Ticket.findById(req.params.id).populate('assignee', 'name');
  if (!t || !canAccess(t, req.user)) return res.status(404).json({ error: 'Not found' });
  res.json(t);
}));

r.post('/:id/reply', wrap(async (req, res) => {
  const t = await Ticket.findById(req.params.id);
  if (!t || !canAccess(t, req.user)) return res.status(404).json({ error: 'Not found' });
  const text = String(req.body?.body || '').trim();
  if (!text) return res.status(400).json({ error: 'Reply cannot be empty' });
  t.messages.push({ from: 'agent', authorId: req.user.id, body: text });
  if (!t.sla.firstRespondedAt) t.sla.firstRespondedAt = new Date();
  if (!t.assignee) t.assignee = req.user.id;
  if (t.status === 'open') t.status = 'pending';
  t.sla.breached = t.sla.breached || isBreached(t);
  await t.save();
  res.json(await t.populate('assignee', 'name'));
}));

r.patch('/:id', wrap(async (req, res) => {
  const t = await Ticket.findById(req.params.id);
  if (!t || !canAccess(t, req.user)) return res.status(404).json({ error: 'Not found' });
  const { status, priority, category, assignee } = req.body || {};
  if (assignee) {
    if (typeof assignee !== 'string' || !mongoose.isValidObjectId(assignee)) return res.status(400).json({ error: 'Invalid assignee' });
    if (req.user.role === 'admin' && !(await User.exists({ _id: assignee, role: 'agent' }))) return res.status(400).json({ error: 'Assignee must be an existing agent' });
  }
  if (typeof status === 'string' && STATUSES.includes(status)) {
    t.status = status;
    if (['resolved', 'closed'].includes(status)) {
      const now = new Date();
      if (!t.sla.resolvedAt) t.sla.resolvedAt = now;
      if (!t.sla.firstRespondedAt) t.sla.firstRespondedAt = now; // resolving counts as a response
    } else {
      t.sla.resolvedAt = null; // reopened (open/pending) -> resolution clock is live again
    }
  }
  if (typeof priority === 'string' && PRIORITIES.includes(priority) && priority !== t.priority) {
    t.priority = priority;
    // SLA targets follow priority: recompute due dates from creation time, keep recorded timestamps.
    const fresh = slaFor(priority, t.createdAt);
    t.sla.firstResponseDue = fresh.firstResponseDue;
    t.sla.resolutionDue = fresh.resolutionDue;
  }
  if (typeof category === 'string' && CATEGORIES.includes(category)) {
    if (category !== t.category) t.set('ai.correctedCategory', category); // feedback loop for retraining
    t.category = category;
  }
  if (assignee !== undefined) {
    if (req.user.role === 'admin') t.assignee = assignee || null;        // admins reassign freely
    else if (assignee === req.user.id) t.assignee = assignee;            // agents can only claim for themselves
  }
  t.sla.breached = t.sla.breached || isBreached(t);
  await t.save();
  res.json(await t.populate('assignee', 'name'));
}));

export default r;
