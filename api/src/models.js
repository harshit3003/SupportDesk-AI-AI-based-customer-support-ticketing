import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const CATEGORIES = ['billing', 'technical', 'account', 'shipping', 'feature_request', 'general'];
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const STATUSES = ['open', 'pending', 'resolved', 'closed'];

export const User = model('User', new Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'agent'], default: 'agent' },
  skills: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  maxOpen: { type: Number, default: 15 },
}, { timestamps: true }));

const messageSchema = new Schema({
  from: { type: String, enum: ['customer', 'agent'], required: true },
  authorId: Schema.Types.ObjectId,
  body: String,
  at: { type: Date, default: Date.now },
}, { _id: false });

const ticketSchema = new Schema({
  subject: { type: String, required: true },
  body: { type: String, required: true },
  customer: { name: String, email: { type: String, required: true } },
  category: { type: String, enum: CATEGORIES, default: 'general' },
  priority: { type: String, enum: PRIORITIES, default: 'medium' },
  status: { type: String, enum: STATUSES, default: 'open' },
  assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  messages: [messageSchema],
  ai: {
    category: String, priority: String, confidence: Number,
    sentiment: Number, source: String, needsReview: Boolean,
    correctedCategory: String, // set when an agent overrides the model -> retraining signal
  },
  sla: {
    firstResponseDue: Date, resolutionDue: Date,
    firstRespondedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    breached: { type: Boolean, default: false },
  },
  csat: { score: { type: Number, min: 1, max: 5 }, comment: String, at: Date },
}, { timestamps: true });

ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });
ticketSchema.index({ assignee: 1, status: 1 });
export const Ticket = model('Ticket', ticketSchema);
