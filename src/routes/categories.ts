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
app.get('/', {
  tags: ['categories'],
  summary: 'List all categories',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            color: z.string().nullable(),
            createdAt: z.date(),
          })),
        },
      },
      description: 'List of categories',
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
app.post('/', {
  tags: ['categories'],
  summary: 'Create a new category',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createCategorySchema,
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
            name: z.string(),
            color: z.string().nullable(),
            createdAt: z.date(),
          }),
        },
      },
      description: 'Category created',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Validation error',
    },
    409: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Category name already exists',
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
    const body = c.req.valid('json')
    const [newCategory] = await db.insert(categories).values(body).returning()
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
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create category',
      },
    }, 500)
  }
})

// Get single category
app.get('/:id', {
  tags: ['categories'],
  summary: 'Get a category by ID',
  request: {
    params: categoryParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().uuid(),
            name: z.string(),
            color: z.string().nullable(),
            createdAt: z.date(),
          }),
        },
      },
      description: 'Category found',
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
  const { id } = c.req.valid('param')
  try {
    const [category] = await db.select().from(categories).where(eq(categories.id, id))
    if (!category) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      }, 404)
    }
    return c.json(category)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch category',
      },
    }, 500)
  }
})

// Update category
app.put('/:id', {
  tags: ['categories'],
  summary: 'Update a category',
  request: {
    params: categoryParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: updateCategorySchema,
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
            name: z.string(),
            color: z.string().nullable(),
            createdAt: z.date(),
          }),
        },
      },
      description: 'Category updated',
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
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  try {
    const [updated] = await db.update(categories).set(body).where(eq(categories.id, id)).returning()
    if (!updated) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      }, 404)
    }
    return c.json(updated)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update category',
      },
    }, 500)
  }
})

// Delete category
app.delete('/:id', {
  tags: ['categories'],
  summary: 'Delete a category',
  request: {
    params: categoryParamsSchema,
  },
  responses: {
    204: {
      description: 'Category deleted',
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
  const { id } = c.req.valid('param')
  try {
    const [deleted] = await db.delete(categories).where(eq(categories.id, id)).returning()
    if (!deleted) {
      return c.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      }, 404)
    }
    return c.newResponse(null, 204)
  } catch (error) {
    return c.json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete category',
      },
    }, 500)
  }
})

export default app
