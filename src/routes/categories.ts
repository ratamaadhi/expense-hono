// src/routes/categories.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { db } from '../db/index.js'
import { categories } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import {
  createCategorySchema,
  updateCategorySchema,
  categoryParamsSchema,
  errorResponseSchema,
} from '../lib/validator.js'

const app = new OpenAPIHono()

// List all categories
app.get('/', async (c) => {
  try {
    const allCategories = await db.select().from(categories).orderBy(categories.createdAt)
    return c.json(allCategories)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch categories',
      },
    }, 500)
  }
})

// Create category
app.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const validated = createCategorySchema.parse(body)
    const [newCategory] = await db.insert(categories).values(validated).returning()
    return c.json(newCategory, 201)
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return c.json({
        error: {
          code: 'CONFLICT',
          message: 'Category name already exists',
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
        message: 'Failed to create category',
      },
    }, 500)
  }
})

// Get single category
app.get('/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const validated = categoryParamsSchema.parse({ id })
    const [category] = await db.select().from(categories).where(eq(categories.id, validated.id))
    if (!category) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      }, 404)
    }
    return c.json(category)
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
        message: 'Failed to fetch category',
      },
    }, 500)
  }
})

// Update category
app.put('/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const validatedParams = categoryParamsSchema.parse({ id })
    const body = await c.req.json()
    const validatedBody = updateCategorySchema.parse(body)
    const [updated] = await db.update(categories).set(validatedBody).where(eq(categories.id, validatedParams.id)).returning()
    if (!updated) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
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
        message: 'Failed to update category',
      },
    }, 500)
  }
})

// Delete category
app.delete('/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const validated = categoryParamsSchema.parse({ id })
    const [deleted] = await db.delete(categories).where(eq(categories.id, validated.id)).returning()
    if (!deleted) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
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
        message: 'Failed to delete category',
      },
    }, 500)
  }
})

export default app
