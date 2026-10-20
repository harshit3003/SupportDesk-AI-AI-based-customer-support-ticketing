import { User, Ticket } from '../models.js';

/** Skill-based, load-balanced assignment. Returns an agent _id or null (stays in the queue). */
export async function pickAgent(category) {
  const agents = await User.find({ active: true, role: 'agent' });
  if (!agents.length) return null;
  const loads = await Ticket.aggregate([
    { $match: { status: { $in: ['open', 'pending'] }, assignee: { $ne: null } } },
    { $group: { _id: '$assignee', n: { $sum: 1 } } },
  ]);
  const load = Object.fromEntries(loads.map((l) => [String(l._id), l.n]));
  const n = (a) => load[String(a._id)] || 0;
  const eligible = agents.filter((a) => n(a) < a.maxOpen);
  const skilled = eligible.filter((a) => a.skills.includes(category));
  const pool = skilled.length ? skilled : eligible;
  if (!pool.length) return null;
  pool.sort((a, b) => n(a) - n(b));
  return pool[0]._id;
}
