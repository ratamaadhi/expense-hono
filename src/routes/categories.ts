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
app.openapi({
  method: 'get',
  path: '/',
  tags: ['categories'],
  summary: 'List all categories',
  responses: {
    200: {
      description: 'List of categories',
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
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
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
app.openapi({
  method: 'post',
  path: '/',
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
      description: 'Category created',
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
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    409: {
      description: 'Category name already exists',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
}, async (c) => {
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
app.openapi({
  method: 'get',
  path: '/{id}',
  tags: ['categories'],
  summary: 'Get a category by ID',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Category found',
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
    },
    404: {
      description: 'Category not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
}, async (c) => {
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
app.openapi({
  method: 'put',
  path: '/{id}',
  tags: ['categories'],
  summary: 'Update a category',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
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
      description: 'Category updated',
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
    },
    404: {
      description: 'Category not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
}, async (c) => {
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
app.openapi({
  method: 'delete',
  path: '/{id}',
  tags: ['categories'],
  summary: 'Delete a category',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'Category deleted',
    },
    404: {
      description: 'Category not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
}, async (c) => {
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
