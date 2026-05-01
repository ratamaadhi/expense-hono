// src/routes/analytics.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { db } from '../db/index.js'
import { transactions, categories } from '../db/schema.js'
import { eq, sql, and } from 'drizzle-orm'
import { errorResponseSchema } from '../lib/validator.js'

const app = new OpenAPIHono()

// Summary endpoint
app.get('/summary', {
  tags: ['analytics'],
  summary: 'Get total income, expense, and net balance',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            totalIncome: z.string(),
            totalExpense: z.string(),
            netBalance: z.string(),
          }),
        },
      },
      description: 'Financial summary',
    },
    500: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Server error',
    },
  },
}, async (c) => {
  try {
    // Total income
    const [incomeResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.type, 'income'))

    // Total expense
    const [expenseResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.type, 'expense'))

    const totalIncome = parseFloat(incomeResult.total || '0')
    const totalExpense = parseFloat(expenseResult.total || '0')
    const netBalance = totalIncome - totalExpense

    return c.json({
      totalIncome: totalIncome.toString(),
      totalExpense: totalExpense.toString(),
      netBalance: netBalance.toString(),
    })
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch summary',
      },
    }, 500)
  }
})

// By category breakdown
app.get('/by-category', {
  tags: ['analytics'],
  summary: 'Get breakdown by category',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.object({
            categoryId: z.string().uuid(),
            categoryName: z.string(),
            totalIncome: z.string(),
            totalExpense: z.string(),
            netBalance: z.string(),
          })),
        },
      },
      description: 'Breakdown by category',
    },
    500: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Server error',
    },
  },
}, async (c) => {
  try {
    const allCategories = await db.select().from(categories)

    const breakdown = await Promise.all(
      allCategories.map(async (category) => {
        // Income for this category
        const [incomeResult] = await db
          .select({
            total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.categoryId, category.id),
              eq(transactions.type, 'income')
            )
          )

        // Expense for this category
        const [expenseResult] = await db
          .select({
            total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.categoryId, category.id),
              eq(transactions.type, 'expense')
            )
          )

        const totalIncome = parseFloat(incomeResult.total || '0')
        const totalExpense = parseFloat(expenseResult.total || '0')
        const netBalance = totalIncome - totalExpense

        return {
          categoryId: category.id,
          categoryName: category.name,
          totalIncome: totalIncome.toString(),
          totalExpense: totalExpense.toString(),
          netBalance: netBalance.toString(),
        }
      })
    )

    return c.json(breakdown)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch category breakdown',
      },
    }, 500)
  }
})

export default app
