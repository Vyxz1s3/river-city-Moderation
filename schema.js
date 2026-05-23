const { pgTable, serial, text, timestamp, boolean } = require('drizzle-orm/pg-core');

// Example: Moderation logs table
const moderationLogs = pgTable('moderation_logs', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(), // 'warn', 'mute', 'kick', 'ban'
  reason: text('reason'),
  moderatorId: text('moderator_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Example: User warnings table
const userWarnings = pgTable('user_warnings', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  userId: text('user_id').notNull(),
  warningCount: serial('warning_count').default(0),
  lastWarningAt: timestamp('last_warning_at'),
});

module.exports = { moderationLogs, userWarnings };
