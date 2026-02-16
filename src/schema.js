const {
  pgTable,
  bigint,
  text,
  boolean,
  timestamp,
  varchar,
  date,
  integer,
  serial,
} = require('drizzle-orm/pg-core');

const items = pgTable('items', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  text: text('text').notNull(),
  completed: boolean('completed').default(false),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  type: varchar('type', { length: 10 }).notNull().default('task'),
  category: varchar('category', { length: 100 }).notNull().default('personal'),
  priority: varchar('priority', { length: 10 }).notNull().default('medium'),
  due_date: date('due_date'),
  notes: text('notes').default(''),
  sort_order: integer('sort_order').default(0),
  user_id: text('user_id'),
});

const learningData = pgTable('learning_data', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  type: varchar('type', { length: 10 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  priority: varchar('priority', { length: 10 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  user_id: text('user_id'),
});

const customCategories = pgTable('custom_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  user_id: text('user_id'),
});

module.exports = { items, learningData, customCategories };
