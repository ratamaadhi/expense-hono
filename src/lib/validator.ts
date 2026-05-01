// src/lib/validator.ts
import { z } from 'zod'

// Category validators
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

export const categoryParamsSchema = z.object({
  id: z.string().uuid(),
})

// Transaction validators
export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive().max(999999999),
  description: z.string().min(1).max(500).optional(),
  categoryId: z.string().uuid(),
  amount: z.number().positive().max(999999999),
  occurredAt: z.string().datetime().optional(),
})

export const updateTransactionSchema = createTransactionSchema.partial()

export const transactionParamsSchema = z.object({
  id: z.string().uuid(),
})

export const listTransactionsQuerySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  categoryId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

// Budget validators
export const createBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive().max(999999999),
  period: z.enum(['monthly', 'yearly']),
})

export const updateBudgetSchema = createBudgetSchema.partial()

export const budgetParamsSchema = z.object({
  id: z.string().uuid(),
})

// Error response type
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({
      field: z.string(),
      message: z.string(),
    })).optional(),
  }),
})
