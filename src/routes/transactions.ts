// src/routes/transactions.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { db } from '../db/index.js'
import { transactions, categories } from '../db/schema.js'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionParamsSchema,
  listTransactionsQuerySchema,
} from '../lib/validator.js'

const app = new OpenAPIHono()

// List transactions with filters
app.get('/', async (c) => {
  try {
    const query = listTransactionsQuerySchema.parse(c.req.query())
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
app.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const validated = createTransactionSchema.parse(body)

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
      occurredAt: validated.occurredAt ? new Date(validated.occurredAt) : new Date(),
    }

    const [newTransaction] = await db.insert(transactions).values(values).returning()
    return c.json(newTransaction, 201)
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
        message: 'Failed to create transaction',
      },
    }, 500)
  }
})

// Get single transaction
app.get('/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const validated = transactionParamsSchema.parse({ id })
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, validated.id))
    if (!transaction) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        },
      }, 404)
    }
    return c.json(transaction)
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
        message: 'Failed to fetch transaction',
      },
    }, 500)
  }
})

// Update transaction
app.put('/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const validatedParams = transactionParamsSchema.parse({ id })
    const body = await c.req.json()
    const validatedBody = updateTransactionSchema.parse(body)

    const values: any = { ...validatedBody }
    if (validatedBody.amount !== undefined) {
      values.amount = validatedBody.amount.toString()
    }
    if (validatedBody.occurredAt !== undefined) {
      values.occurredAt = new Date(validatedBody.occurredAt)
    }

    const [updated] = await db.update(transactions).set(values).where(eq(transactions.id, validatedParams.id)).returning()
    if (!updated) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        },
      }, 404)
    }
    return c.json(updated)
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
        message: 'Failed to update transaction',
      },
    }, 500)
  }
})

// Delete transaction
app.delete('/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const validated = transactionParamsSchema.parse({ id })
    const [deleted] = await db.delete(transactions).where(eq(transactions.id, validated.id)).returning()
    if (!deleted) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Transaction not found',
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
        message: 'Failed to delete transaction',
      },
    }, 500)
  }
})

export default app
