import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Ticket, CATEGORIES } from './models.js';
import { slaFor, isBreached } from './services/sla.js';

await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/support');
await Promise.all([User.deleteMany({}), Ticket.deleteMany({})]);

const hash = await bcrypt.hash('password123', 10);
await User.create({ name: 'Admin', email: 'admin@demo.com', role: 'admin', passwordHash: hash });
const agents = await User.insertMany([
  { name: 'Asha Verma', email: 'asha@demo.com', passwordHash: hash, skills: ['billing', 'account'] },
  { name: 'Rohan Mehta', email: 'rohan@demo.com', passwordHash: hash, skills: ['technical', 'feature_request'] },
  { name: 'Priya Nair', email: 'priya@demo.com', passwordHash: hash, skills: ['shipping', 'general', 'billing'] },
]);

const SUBJECTS = {
  billing: 'Charged twice for my subscription', technical: 'App crashes on dashboard load', account: 'Cannot reset my password',
  shipping: 'Order has not arrived', feature_request: 'Please add CSV export', general: 'Question about enterprise plans',
};
const PRI = ['low', 'medium', 'medium', 'high', 'urgent'];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const DAY = 86400000;

const docs = [];
for (let i = 0; i < 120; i++) {
  const category = rnd(CATEGORIES), priority = rnd(PRI);
  const createdAt = new Date(Date.now() - Math.random() * 30 * DAY);
  const agent = rnd(agents.filter((a) => a.skills.includes(category)).concat(agents));
  const sla = slaFor(priority, createdAt);
  const responded = Math.random() < 0.9;
  if (responded) sla.firstRespondedAt = new Date(createdAt.getTime() + Math.random() * 300 * 60000);
  const resolved = responded && Math.random() < 0.75;
  if (resolved) sla.resolvedAt = new Date(sla.firstRespondedAt.getTime() + Math.random() * 1800 * 60000);
  const t = {
    subject: SUBJECTS[category], body: `${SUBJECTS[category]}. Please help.`,
    customer: { name: `Customer ${i}`, email: `customer${i}@example.com` },
    category, priority, status: resolved ? 'resolved' : responded ? 'pending' : 'open',
    assignee: agent._id, createdAt, sla,
    ai: { category, priority, confidence: 0.6 + Math.random() * 0.4, sentiment: 0, source: 'seed', needsReview: false },
    messages: [{ from: 'customer', body: SUBJECTS[category], at: createdAt }],
  };
  t.sla.breached = isBreached(t);
  if (resolved && Math.random() < 0.6) t.csat = { score: rnd([1, 2, 3, 4, 4, 5, 5, 5]), at: sla.resolvedAt };
  docs.push(t);
}
await Ticket.insertMany(docs);
console.log('Seeded. Login: admin@demo.com / password123 (agents: asha@, rohan@, priya@demo.com)');
await mongoose.disconnect();
