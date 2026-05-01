// src/routes/budgets.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { db } from '../db/index.js'
import { budgets, categories, transactions } from '../db/schema.js'
import { eq, and, gte, sql } from 'drizzle-orm'
import {
  createBudgetSchema,
  updateBudgetSchema,
  budgetParamsSchema,
  errorResponseSchema,
} from '../lib/validator.js'

const app = new OpenAPIHono()

// Helper function to calculate budget utilization
async function getBudgetUtilization(budgetId: string) {
  const [budget] = await db.select().from(budgets).where(eq(budgets.id, budgetId))
  if (!budget) return null

  const budgetAmount = parseFloat(budget.amount)

  // Calculate start of period based on budget period
  const now = new Date()
  const periodStart = new Date()

  if (budget.period === 'monthly') {
    periodStart.setDate(1)
    periodStart.setHours(0, 0, 0, 0)
  } else {
    periodStart.setMonth(0, 1)
    periodStart.setHours(0, 0, 0, 0)
  }

  // Get all expense transactions for this category within the period
  const spentResults = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.categoryId, budget.categoryId),
        eq(transactions.type, 'expense'),
        gte(transactions.occurredAt, periodStart)
      )
    )

  const spent = parseFloat(spentResults[0]?.total || '0')
  const remaining = budgetAmount - spent
  const utilizationPercentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0

  return {
    ...budget,
    spent: spent.toString(),
    remaining: remaining.toString(),
    utilizationPercentage,
  }
}

// List all budgets with utilization
app.get('/', {
  tags: ['budgets'],
  summary: 'List all budgets with utilization',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string().uuid(),
            categoryId: z.string().uuid(),
            amount: z.string(),
            period: z.enum(['monthly', 'yearly']),
            createdAt: z.date(),
            spent: z.string(),
            remaining: z.string(),
            utilizationPercentage: z.number(),
          })),
        },
      },
      description: 'List of budgets with utilization',
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
    const allBudgets = await db.select().from(budgets)
    const budgetsWithUtilization = await Promise.all(
      allBudgets.map(async (budget) => await getBudgetUtilization(budget.id))
    )
    return c.json(budgetsWithUtilization.filter(Boolean))
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch budgets',
      },
    }, 500)
  }
})

// Create budget
app.post('/', {
  tags: ['budgets'],
  summary: 'Create a new budget',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createBudgetSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().uuid(),
            categoryId: z.string().uuid(),
            amount: z.string(),
            period: z.enum(['monthly', 'yearly']),
            createdAt: z.date(),
            spent: z.string(),
            remaining: z.string(),
            utilizationPercentage: z.number(),
          }),
        },
      },
      description: 'Budget created',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Validation error',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Category not found',
    },
    409: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Budget already exists for this category',
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
  const body = c.req.valid('json')
  try {
    // Verify category exists
    const [category] = await db.select().from(categories).where(eq(categories.id, body.categoryId))
    if (!category) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      }, 404)
    }

    const values = {
      ...body,
      amount: body.amount.toString(),
    }

    const [newBudget] = await db.insert(budgets).values(values).returning()
    const budgetWithUtilization = await getBudgetUtilization(newBudget.id)
    return c.json(budgetWithUtilization, 201)
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return c.json({
        error: {
          code: 'CONFLICT',
          message: 'Budget already exists for this category',
        },
      }, 409)
    }
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create budget',
      },
    }, 500)
  }
})

// Get single budget with utilization
app.get('/:id', {
  tags: ['budgets'],
  summary: 'Get a budget by ID with utilization',
  request: {
    params: budgetParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().uuid(),
            categoryId: z.string().uuid(),
            amount: z.string(),
            period: z.enum(['monthly', 'yearly']),
            createdAt: z.date(),
            spent: z.string(),
            remaining: z.string(),
            utilizationPercentage: z.number(),
          }),
        },
      },
      description: 'Budget found',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Budget not found',
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
  const { id } = c.req.valid('param')
  try {
    const budgetWithUtilization = await getBudgetUtilization(id)
    if (!budgetWithUtilization) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Budget not found',
        },
      }, 404)
    }
    return c.json(budgetWithUtilization)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch budget',
      },
    }, 500)
  }
})

// Update budget
app.put('/:id', {
  tags: ['budgets'],
  summary: 'Update a budget',
  request: {
    params: budgetParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: updateBudgetSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().uuid(),
            categoryId: z.string().uuid(),
            amount: z.string(),
            period: z.enum(['monthly', 'yearly']),
            createdAt: z.date(),
            spent: z.string(),
            remaining: z.string(),
            utilizationPercentage: z.number(),
          }),
        },
      },
      description: 'Budget updated',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Budget not found',
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
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  try {
    const values: any = { ...body }
    if (body.amount !== undefined) {
      values.amount = body.amount.toString()
    }

    const [updated] = await db.update(budgets).set(values).where(eq(budgets.id, id)).returning()
    if (!updated) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Budget not found',
        },
      }, 404)
    }

    const budgetWithUtilization = await getBudgetUtilization(id)
    return c.json(budgetWithUtilization)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update budget',
      },
    }, 500)
  }
})

// Delete budget
app.delete('/:id', {
  tags: ['budgets'],
  summary: 'Delete a budget',
  request: {
    params: budgetParamsSchema,
  },
  responses: {
    204: {
      description: 'Budget deleted',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Budget not found',
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
  const { id } = c.req.valid('param')
  try {
    const [deleted] = await db.delete(budgets).where(eq(budgets.id, id)).returning()
    if (!deleted) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Budget not found',
        },
      }, 404)
    }
    return c.newResponse(null, 204)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete budget',
      },
    }, 500)
  }
})

export default app
