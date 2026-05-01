// src/routes/transactions.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { db } from '../db/index.js'
import { transactions, categories } from '../db/schema.js'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionParamsSchema,
  listTransactionsQuerySchema,
  errorResponseSchema,
} from '../lib/validator.js'

const app = new OpenAPIHono()

// List transactions with filters
app.get('/', {
  tags: ['transactions'],
  summary: 'List transactions with optional filters',
  request: {
    query: listTransactionsQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string().uuid(),
            type: z.enum(['income', 'expense']),
            amount: z.string(),
            description: z.string().nullable(),
            categoryId: z.string().uuid().nullable(),
            occurredAt: z.date(),
            createdAt: z.date(),
          })),
        },
      },
      description: 'List of transactions',
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
  const query = c.req.valid('query')
  try {
    let conditions = []

    if (query.type) {
      conditions.push(eq(transactions.type, query.type))
    }
    if (query.categoryId) {
      conditions.push(eq(transactions.categoryId, query.categoryId))
    }
    if (query.from) {
      conditions.push(gte(transactions.occurredAt, new Date(query.from)))
    }
    if (query.to) {
      conditions.push(lte(transactions.occurredAt, new Date(query.to)))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const allTransactions = await db
      .select()
      .from(transactions)
      .where(whereClause)
      .orderBy(desc(transactions.occurredAt))

    return c.json(allTransactions)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch transactions',
      },
    }, 500)
  }
})

// Create transaction
app.post('/', {
  tags: ['transactions'],
  summary: 'Create a new transaction',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createTransactionSchema,
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
            type: z.enum(['income', 'expense']),
            amount: z.string(),
            description: z.string().nullable(),
            categoryId: z.string().uuid(),
            occurredAt: z.date(),
            createdAt: z.date(),
          }),
        },
      },
      description: 'Transaction created',
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
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    }

    const [newTransaction] = await db.insert(transactions).values(values).returning()
    return c.json(newTransaction, 201)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create transaction',
      },
    }, 500)
  }
})

// Get single transaction
app.get('/:id', {
  tags: ['transactions'],
  summary: 'Get a transaction by ID',
  request: {
    params: transactionParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().uuid(),
            type: z.enum(['income', 'expense']),
            amount: z.string(),
            description: z.string().nullable(),
            categoryId: z.string().uuid().nullable(),
            occurredAt: z.date(),
            createdAt: z.date(),
          }),
        },
      },
      description: 'Transaction found',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Transaction not found',
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
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id))
    if (!transaction) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        },
      }, 404)
    }
    return c.json(transaction)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch transaction',
      },
    }, 500)
  }
})

// Update transaction
app.put('/:id', {
  tags: ['transactions'],
  summary: 'Update a transaction',
  request: {
    params: transactionParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: updateTransactionSchema,
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
            type: z.enum(['income', 'expense']),
            amount: z.string(),
            description: z.string().nullable(),
            categoryId: z.string().uuid().nullable(),
            occurredAt: z.date(),
            createdAt: z.date(),
          }),
        },
      },
      description: 'Transaction updated',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Transaction not found',
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
    if (body.occurredAt !== undefined) {
      values.occurredAt = new Date(body.occurredAt)
    }

    const [updated] = await db.update(transactions).set(values).where(eq(transactions.id, id)).returning()
    if (!updated) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        },
      }, 404)
    }
    return c.json(updated)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update transaction',
      },
    }, 500)
  }
})

// Delete transaction
app.delete('/:id', {
  tags: ['transactions'],
  summary: 'Delete a transaction',
  request: {
    params: transactionParamsSchema,
  },
  responses: {
    204: {
      description: 'Transaction deleted',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Transaction not found',
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
    const [deleted] = await db.delete(transactions).where(eq(transactions.id, id)).returning()
    if (!deleted) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        },
      }, 404)
    }
    return c.newResponse(null, 204)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete transaction',
      },
    }, 500)
  }
})

export default app
