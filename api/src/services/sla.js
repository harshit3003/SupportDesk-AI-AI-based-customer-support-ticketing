import { Ticket } from '../models.js';

// minutes: [first response, resolution]
export const SLA_POLICY = {
  urgent: [15, 240],
  high: [60, 480],
  medium: [240, 1440],
  low: [480, 4320],
};

export function slaFor(priority, from = new Date()) {
  const [fr, res] = SLA_POLICY[priority] || SLA_POLICY.medium;
  return {
    firstResponseDue: new Date(from.getTime() + fr * 60000),
    resolutionDue: new Date(from.getTime() + res * 60000),
    firstRespondedAt: null, resolvedAt: null, breached: false,
  };
}

export function isBreached(t, now = new Date()) {
  const s = t.sla;
  const fr = s.firstRespondedAt ? s.firstRespondedAt > s.firstResponseDue : now > s.firstResponseDue;
  const res = s.resolvedAt ? s.resolvedAt > s.resolutionDue : now > s.resolutionDue;
  return fr || res;
}

/** Periodic sweep that flags open tickets that have blown their SLA. */
export function startSlaSweeper(intervalMs = 60000) {
  const sweep = async () => {
    const now = new Date();
    await Ticket.updateMany(
      {
        status: { $in: ['open', 'pending'] }, 'sla.breached': false,
        $or: [
          { 'sla.firstResponseDue': { $lt: now }, 'sla.firstRespondedAt': null },
          { 'sla.resolutionDue': { $lt: now } },
        ],
      },
      { $set: { 'sla.breached': true } },
    ).catch((e) => console.error('SLA sweep failed', e.message));
  };
  sweep();
  return setInterval(sweep, intervalMs);
}
