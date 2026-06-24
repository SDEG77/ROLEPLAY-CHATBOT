const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: true,
    timestamps: true,
  },
);

const memorySchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['campaign', 'character', 'npc', 'location', 'quest', 'item', 'fact'],
      default: 'fact',
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      default: 'scene',
      trim: true,
    },
    lastReinforcedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
    timestamps: true,
  },
);

const inventoryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
    details: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['carried', 'equipped', 'stored'],
      default: 'carried',
    },
  },
  {
    _id: true,
    timestamps: true,
  },
);

const campaignSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    playerName: {
      type: String,
      required: true,
      trim: true,
    },
    characterName: {
      type: String,
      required: true,
      trim: true,
    },
    campaignIdea: {
      type: String,
      required: true,
      trim: true,
    },
    tone: {
      type: String,
      default: 'Heroic fantasy with dramatic choices',
      trim: true,
    },
    playStyle: {
      type: String,
      default: 'Roleplay-first adventure',
      trim: true,
    },
    activeAiProvider: {
      type: String,
      default: '',
      trim: true,
    },
    activeAiModel: {
      type: String,
      default: '',
      trim: true,
    },
    activeAiMode: {
      type: String,
      default: '',
      trim: true,
    },
    lastAiAt: {
      type: Date,
      default: null,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    memories: {
      type: [memorySchema],
      default: [],
    },
    inventory: {
      type: [inventoryItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

campaignSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
