// src/routes/budgets.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { db } from '../db/index.js'
import { budgets, categories, transactions } from '../db/schema.js'
import { eq, and, gte, sql, isNull } from 'drizzle-orm'
import {
  createBudgetSchema,
  updateBudgetSchema,
  budgetParamsSchema,
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
        budget.categoryId ? eq(transactions.categoryId, budget.categoryId) : isNull(transactions.categoryId),
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
app.openapi({
  method: 'get',
  path: '/',
  tags: ['budgets'],
  summary: 'List all budgets with utilization data',
  responses: {
    200: {
      description: 'List of budgets with utilization',
      content: {
        'application/json': {
          schema: z.array(z.any()),
        },
      },
    },
    500: {
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
app.openapi({
  method: 'post',
  path: '/',
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
      description: 'Budget created successfully',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            categoryId: z.string().optional(),
            amount: z.string(),
            period: z.enum(['monthly', 'yearly']),
            spent: z.string(),
            remaining: z.string(),
            utilizationPercentage: z.number(),
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
    },
    404: {
      description: 'Category not found',
    },
    409: {
      description: 'Budget already exists for this category',
    },
    500: {
      description: 'Server error',
    },
  },
}, async (c) => {
  try {
    const body = await c.req.json()
    const validated = createBudgetSchema.parse(body)

    // Verify category exists
    const [category] = await db.select().from(categories).where(eq(categories.id, validated.categoryId))
    if (!category) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      }, 404)
    }

    const values = {
      ...validated,
      amount: validated.amount.toString(),
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
    if (error.name === 'ZodError') {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      }, 400)
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
app.openapi({
  method: 'get',
  path: '/{id}',
  tags: ['budgets'],
  summary: 'Get a single budget with utilization data',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Budget details with utilization',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            categoryId: z.string().optional(),
            amount: z.string(),
            period: z.enum(['monthly', 'yearly']),
            spent: z.string(),
            remaining: z.string(),
            utilizationPercentage: z.number(),
          }),
        },
      },
    },
    400: {
      description: 'Invalid ID format',
    },
    404: {
      description: 'Budget not found',
    },
    500: {
      description: 'Server error',
    },
  },
}, async (c) => {
  const { id } = c.req.param()
  try {
    const validated = budgetParamsSchema.parse({ id })
    const budgetWithUtilization = await getBudgetUtilization(validated.id)
    if (!budgetWithUtilization) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Budget not found',
        },
      }, 404)
    }
    return c.json(budgetWithUtilization)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid ID format',
        },
      }, 400)
    }
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch budget',
      },
    }, 500)
  }
})

// Update budget
app.openapi({
  method: 'put',
  path: '/{id}',
  tags: ['budgets'],
  summary: 'Update a budget by ID',
  request: {
    params: z.object({
      id: z.string(),
    }),
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
      description: 'Budget updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            categoryId: z.string().optional(),
            amount: z.string(),
            period: z.enum(['monthly', 'yearly']),
            spent: z.string(),
            remaining: z.string(),
            utilizationPercentage: z.number(),
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
    },
    404: {
      description: 'Budget not found',
    },
    500: {
      description: 'Server error',
    },
  },
}, async (c) => {
  const { id } = c.req.param()
  try {
    const validatedParams = budgetParamsSchema.parse({ id })
    const body = await c.req.json()
    const validatedBody = updateBudgetSchema.parse(body)

    const values: any = { ...validatedBody }
    if (validatedBody.amount !== undefined) {
      values.amount = validatedBody.amount.toString()
    }

    const [updated] = await db.update(budgets).set(values).where(eq(budgets.id, validatedParams.id)).returning()
    if (!updated) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Budget not found',
        },
      }, 404)
    }

    const budgetWithUtilization = await getBudgetUtilization(validatedParams.id)
    return c.json(budgetWithUtilization)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      }, 400)
    }
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update budget',
      },
    }, 500)
  }
})

// Delete budget
app.openapi({
  method: 'delete',
  path: '/{id}',
  tags: ['budgets'],
  summary: 'Delete a budget by ID',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    204: {
      description: 'Budget deleted successfully',
    },
    400: {
      description: 'Invalid ID format',
    },
    404: {
      description: 'Budget not found',
    },
    500: {
      description: 'Server error',
    },
  },
}, async (c) => {
  const { id } = c.req.param()
  try {
    const validated = budgetParamsSchema.parse({ id })
    const [deleted] = await db.delete(budgets).where(eq(budgets.id, validated.id)).returning()
    if (!deleted) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Budget not found',
        },
      }, 404)
    }
    return c.newResponse(null, 204)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid ID format',
        },
      }, 400)
    }
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete budget',
      },
    }, 500)
  }
})

export default app
