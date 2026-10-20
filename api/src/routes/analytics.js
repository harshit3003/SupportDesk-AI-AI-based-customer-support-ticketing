import { Router } from 'express';
import { Ticket } from '../models.js';
import { auth, wrap } from '../middleware.js';

const r = Router();
r.use(auth());

const toMin = (ms) => (ms == null ? null : Math.round((ms / 60000) * 10) / 10);
const round2 = (x) => Math.round(x * 100) / 100;

r.get('/overview', wrap(async (_req, res) => {
  const [byStatus, byCategory, byPriority, totals, times] = await Promise.all([
    Ticket.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Ticket.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Ticket.aggregate([{ $group: { _id: '$priority', n: { $sum: 1 } } }]),
    Ticket.aggregate([{ $group: { _id: null, total: { $sum: 1 },
      breached: { $sum: { $cond: ['$sla.breached', 1, 0] } },
      unassigned: { $sum: { $cond: [{ $eq: ['$assignee', null] }, 1, 0] } },
      needsReview: { $sum: { $cond: ['$ai.needsReview', 1, 0] } } } }]),
    Ticket.aggregate([{ $group: { _id: null,
      frt: { $avg: { $cond: ['$sla.firstRespondedAt', { $subtract: ['$sla.firstRespondedAt', '$createdAt'] }, null] } },
      res: { $avg: { $cond: ['$sla.resolvedAt', { $subtract: ['$sla.resolvedAt', '$createdAt'] }, null] } } } }]),
  ]);
  const t = totals[0] || { total: 0, breached: 0, unassigned: 0, needsReview: 0 };
  res.json({
    total: t.total, unassigned: t.unassigned, needsReview: t.needsReview, breached: t.breached,
    slaCompliance: t.total ? Math.round(((t.total - t.breached) / t.total) * 1000) / 10 : 100,
    avgFirstResponseMin: toMin(times[0]?.frt), avgResolutionMin: toMin(times[0]?.res),
    byStatus, byCategory, byPriority,
  });
}));

r.get('/sla-risk', wrap(async (_req, res) => {
  const soon = new Date(Date.now() + 60 * 60000);
  res.json(await Ticket.find({
    status: { $in: ['open', 'pending'] },
    $or: [
      { 'sla.breached': true },
      { 'sla.firstRespondedAt': null, 'sla.firstResponseDue': { $lt: soon } },
      { 'sla.resolutionDue': { $lt: soon } },
    ],
  }).sort({ 'sla.resolutionDue': 1 }).limit(25).populate('assignee', 'name'));
}));

r.get('/agents', wrap(async (_req, res) => {
  const rows = await Ticket.aggregate([
    { $match: { assignee: { $ne: null } } },
    { $group: { _id: '$assignee', assigned: { $sum: 1 },
      open: { $sum: { $cond: [{ $in: ['$status', ['open', 'pending']] }, 1, 0] } },
      resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } },
      breaches: { $sum: { $cond: ['$sla.breached', 1, 0] } },
      avgFrt: { $avg: { $cond: ['$sla.firstRespondedAt', { $subtract: ['$sla.firstRespondedAt', '$createdAt'] }, null] } },
      avgRes: { $avg: { $cond: ['$sla.resolvedAt', { $subtract: ['$sla.resolvedAt', '$createdAt'] }, null] } },
      csat: { $avg: '$csat.score' }, csatCount: { $sum: { $cond: ['$csat.score', 1, 0] } } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $project: { name: '$u.name', assigned: 1, open: 1, resolved: 1, breaches: 1, avgFrt: 1, avgRes: 1, csat: 1, csatCount: 1 } },
    { $sort: { resolved: -1 } },
  ]);
  res.json(rows.map((a) => ({
    id: a._id, name: a.name, assigned: a.assigned, open: a.open, resolved: a.resolved, breaches: a.breaches,
    slaCompliance: a.assigned ? Math.round(((a.assigned - a.breaches) / a.assigned) * 100) : 100,
    avgFirstResponseMin: toMin(a.avgFrt), avgResolutionMin: toMin(a.avgRes),
    csat: a.csat ? round2(a.csat) : null, csatCount: a.csatCount,
  })));
}));

r.get('/csat', wrap(async (_req, res) => {
  const rated = { $match: { 'csat.score': { $exists: true } } };
  const since = new Date(Date.now() - 30 * 86400000);
  const [summary, dist, trend, byCategory] = await Promise.all([
    Ticket.aggregate([rated, { $group: { _id: null, avg: { $avg: '$csat.score' }, n: { $sum: 1 }, sat: { $sum: { $cond: [{ $gte: ['$csat.score', 4] }, 1, 0] } } } }]),
    Ticket.aggregate([rated, { $group: { _id: '$csat.score', n: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: { 'csat.at': { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$csat.at' } }, avg: { $avg: '$csat.score' }, n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Ticket.aggregate([rated, { $group: { _id: '$category', avg: { $avg: '$csat.score' }, n: { $sum: 1 } } }, { $sort: { avg: 1 } }]),
  ]);
  const s = summary[0];
  res.json({
    average: s ? round2(s.avg) : null, responses: s?.n || 0, satisfiedPct: s ? Math.round((s.sat / s.n) * 100) : null,
    distribution: [1, 2, 3, 4, 5].map((k) => ({ score: k, n: dist.find((d) => d._id === k)?.n || 0 })),
    trend: trend.map((t) => ({ day: t._id, avg: round2(t.avg), n: t.n })),
    byCategory: byCategory.map((c) => ({ category: c._id, avg: round2(c.avg), n: c.n })),
  });
}));

export default r;
