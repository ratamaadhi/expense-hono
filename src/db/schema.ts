// src/db/schema.ts
import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense'])
export const budgetPeriodEnum = pgEnum('budget_period', ['monthly', 'yearly'])

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  color: text('color'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: transactionTypeEnum('type').notNull(),
  amount: text('amount').notNull(), // Store as text for precision, parse as number
  description: text('description'),
  categoryId: uuid('category_id').references(() => categories.id),
  occurredAt: timestamp('occurred_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => categories.id).unique(),
  amount: text('amount').notNull(),
  period: budgetPeriodEnum('period').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
