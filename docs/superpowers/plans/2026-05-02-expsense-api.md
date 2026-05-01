# Expsense API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal expense tracker API with income/expense tracking, categories, and budgets using Hono, Scalar OpenAPI, Drizzle ORM, PostgreSQL, and Zod.

**Architecture:** Modular route-based approach with separate modules for transactions, categories, and budgets. Each route handles its own validation via Zod schemas and database operations via Drizzle ORM. OpenAPI documentation auto-generated via hono-zod-openapi, with Scalar UI at /docs.

**Tech Stack:** Hono (web framework), hono-zod-openapi (OpenAPI generation), @scalar/hono-api-reference (docs UI), Drizzle ORM (database), PostgreSQL (database), Zod (validation), postgres.js (driver), Drizzle Kit (migrations)

---

## File Structure

**Files to create:**
```
src/
├── index.ts                    # App entry point, route aggregation
├── routes/
│   ├── index.ts                # Route aggregator (exports all routes)
│   ├── transactions.ts         # Transaction CRUD endpoints
│   ├── categories.ts           # Category CRUD endpoints
│   └── budgets.ts              # Budget CRUD + utilization endpoints
├── db/
│   ├── index.ts                # DB connection export
│   ├── schema.ts               # Drizzle schema definitions
│   └── migrations/             # Auto-generated (no manual creation)
└── lib/
    ├── validator.ts            # Zod schemas for all endpoints
    └── types.ts                # Shared TypeScript types

drizzle.config.ts              # Drizzle Kit configuration
package.json                   # Dependencies
tsconfig.json                  # TypeScript config
.env.example                   # Environment variables template
```

---

## Task 1: Initialize Project and Dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Create package.json with all dependencies**

```bash
npm init -y
```

Edit `package.json`:
```json
{
  "name": "expsense-api-hono",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@hono/zod-openapi": "^0.16.0",
    "@scalar/hono-api-reference": "^0.5.0",
    "drizzle-orm": "^0.36.0",
    "hono": "^4.6.0",
    "postgres": "^3.4.5",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.27.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: All packages install successfully with no errors.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create .env.example**

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/expsense

# Server
PORT=3000
```

- [ ] **Step 5: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 6: Commit project setup**

```bash
git add package.json tsconfig.json .env.example drizzle.config.ts
git commit -m "chore: initialize project with dependencies"
```

---

## Task 2: Database Schema and Connection

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`

- [ ] **Step 1: Create schema.ts with all table definitions**

```typescript
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
```

- [ ] **Step 2: Create db/index.ts with connection export**

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

const client = postgres(connectionString)
export const db = drizzle(client, { schema })
```

- [ ] **Step 3: Generate initial migration**

```bash
npm run db:generate
```

Expected: Creates migration file in `src/db/migrations/` with CREATE TABLE statements.

- [ ] **Step 4: Push schema to database**

```bash
npm run db:push
```

Expected: Tables created successfully in PostgreSQL database.

- [ ] **Step 5: Commit schema and connection**

```bash
git add src/db/
git commit -m "feat: add database schema and connection"
```

---

## Task 3: Shared Types and Validators

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/validator.ts`

- [ ] **Step 1: Create shared types**

```typescript
// src/lib/types.ts
export interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: string
  description: string | null
  categoryId: string | null
  occurredAt: Date
  createdAt: Date
}

export interface Category {
  id: string
  name: string
  color: string | null
  createdAt: Date
}

export interface Budget {
  id: string
  categoryId: string
  amount: string
  period: 'monthly' | 'yearly'
  createdAt: Date
}

export interface BudgetWithUtilization extends Budget {
  spent: string
  remaining: string
  utilizationPercentage: number
}
```

- [ ] **Step 2: Create Zod validators for all endpoints**

```typescript
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
```

- [ ] **Step 3: Commit types and validators**

```bash
git add src/lib/
git commit -m "feat: add shared types and Zod validators"
```

---

## Task 4: Categories API with Tests

**Files:**
- Create: `src/routes/categories.ts`
- Create: `src/routes/index.ts`

- [ ] **Step 1: Create categories route with OpenAPI decorators**

```typescript
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
```

- [ ] **Step 2: Create routes/index.ts aggregator**

```typescript
// src/routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import categories from './categories.js'

const app = new OpenAPIHono()

app.route('/categories', categories)

export default app
```

- [ ] **Step 3: Commit categories API**

```bash
git add src/routes/
git commit -m "feat: add categories CRUD endpoints with OpenAPI"
```

---

## Task 5: Transactions API

**Files:**
- Modify: `src/routes/index.ts`
- Create: `src/routes/transactions.ts`

- [ ] **Step 1: Create transactions route**

```typescript
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
```

- [ ] **Step 2: Update routes/index.ts to include transactions**

```typescript
// src/routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import categories from './categories.js'
import transactions from './transactions.js'

const app = new OpenAPIHono()

app.route('/categories', categories)
app.route('/transactions', transactions)

export default app
```

- [ ] **Step 3: Commit transactions API**

```bash
git add src/routes/
git commit -m "feat: add transactions CRUD endpoints with filtering"
```

---

## Task 6: Budgets API with Utilization

**Files:**
- Modify: `src/routes/index.ts`
- Create: `src/routes/budgets.ts`

- [ ] **Step 1: Create budgets route**

```typescript
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
```

- [ ] **Step 2: Update routes/index.ts to include budgets**

```typescript
// src/routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import categories from './categories.js'
import transactions from './transactions.js'
import budgets from './budgets.js'

const app = new OpenAPIHono()

app.route('/categories', categories)
app.route('/transactions', transactions)
app.route('/budgets', budgets)

export default app
```

- [ ] **Step 3: Commit budgets API**

```bash
git add src/routes/
git commit -m "feat: add budgets CRUD endpoints with utilization calculation"
```

---

## Task 7: Analytics Endpoints

**Files:**
- Create: `src/routes/analytics.ts`
- Modify: `src/routes/index.ts`

- [ ] **Step 1: Create analytics route**

```typescript
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
```

- [ ] **Step 2: Update routes/index.ts to include analytics**

```typescript
// src/routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import categories from './categories.js'
import transactions from './transactions.js'
import budgets from './budgets.js'
import analytics from './analytics.js'

const app = new OpenAPIHono()

app.route('/categories', categories)
app.route('/transactions', transactions)
app.route('/budgets', budgets)
app.route('/analytics', analytics)

export default app
```

- [ ] **Step 3: Commit analytics endpoints**

```bash
git add src/routes/
git commit -m "feat: add analytics endpoints (summary and by-category)"
```

---

## Task 8: Main App Entry Point with Scalar UI

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create main app entry point**

```typescript
// src/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import routes from './routes/index.js'

const app = new OpenAPIHono()

// API routes
app.route('/api', routes)

// OpenAPI documentation
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Expsense API',
    version: '1.0.0',
    description: 'Personal expense tracker API with income, expenses, categories, and budgets',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development',
    },
  ],
})

// Scalar UI
app.get('/docs', apiReference({
  url: '/openapi.json',
  theme: 'default',
  layout: 'classic',
}))

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'Expsense API is running' })
})

const port = parseInt(process.env.PORT || '3000')

console.log(`Server starting on port ${port}`)
console.log(`API docs available at http://localhost:${port}/docs`)

export default {
  port,
  fetch: app.fetch,
}
```

- [ ] **Step 2: Test the application starts**

```bash
npm run dev
```

Expected: Server starts on port 3000, log messages show port and docs URL.

- [ ] **Step 3: Verify endpoints are accessible**

Visit http://localhost:3000/docs in browser.

Expected: Scalar UI displays with all API endpoints documented.

- [ ] **Step 4: Stop the server and commit**

```bash
git add src/index.ts
git commit -m "feat: add main app entry point with Scalar UI"
```

---

## Task 9: Manual Testing Checklist

**No file changes - verification step**

- [ ] **Step 1: Test health check**

```bash
curl http://localhost:3000/
```

Expected: `{"status":"ok","message":"Expsense API is running"}`

- [ ] **Step 2: Test creating a category**

```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -d '{"name":"Groceries","color":"#FF5733"}'
```

Expected: Returns created category with id.

- [ ] **Step 3: Test creating an expense transaction**

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":50.00,"description":"Weekly groceries","categoryId":"<CATEGORY_ID>"}'
```

Expected: Returns created transaction.

- [ ] **Step 4: Test creating an income transaction**

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"income","amount":5000.00,"description":"Monthly salary","categoryId":"<CATEGORY_ID>"}'
```

Expected: Returns created transaction.

- [ ] **Step 5: Test creating a budget**

```bash
curl -X POST http://localhost:3000/api/budgets \
  -H "Content-Type: application/json" \
  -d '{"categoryId":"<CATEGORY_ID>","amount":500.00,"period":"monthly"}'
```

Expected: Returns created budget with utilization (spent: 50.00, remaining: 450.00).

- [ ] **Step 6: Test analytics summary**

```bash
curl http://localhost:3000/api/analytics/summary
```

Expected: Returns totals for income, expense, and net balance.

- [ ] **Step 7: Test filtering transactions**

```bash
curl "http://localhost:3000/api/transactions?type=expense"
```

Expected: Returns only expense transactions.

- [ ] **Step 8: Verify Scalar UI is complete**

Visit http://localhost:3000/docs

Expected: All endpoints visible with schemas, can try requests directly.

---

## Task 10: Production Readiness Checklist

**Files:**
- Create: `.gitignore`
- Update: `package.json` (if needed)

- [ ] **Step 1: Create .gitignore**

```bash
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.log
.DS_Store
drizzle/
EOF
```

- [ ] **Step 2: Verify all dependencies are in package.json**

Run: `cat package.json | grep -A 20 "dependencies"`

Expected: All required packages listed (hono, @hono/zod-openapi, @scalar/hono-api-reference, drizzle-orm, postgres, zod).

- [ ] **Step 3: Verify tsconfig.json is correct**

Run: `cat tsconfig.json`

Expected: Config matches Task 1 Step 3.

- [ ] **Step 4: Verify DATABASE_URL is set**

Run: `echo $DATABASE_URL`

Expected: Valid PostgreSQL connection string.

- [ ] **Step 5: Run all migrations**

```bash
npm run db:push
```

Expected: "No changes needed" or tables created successfully.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: add production readiness files (.gitignore, cleanup)"
```

---

## Completion Criteria

After completing all tasks, verify:

- [ ] Server starts without errors
- [ ] All CRUD operations work for categories, transactions, budgets
- [ ] Scalar UI displays at `/docs` with complete documentation
- [ ] Analytics endpoints return accurate data
- [ ] Budgets correctly calculate utilization
- [ ] Transaction filtering works by type, category, and date range
- [ ] Database migrations are reproducible
- [ ] Error responses follow consistent format
- [ ] All endpoints have OpenAPI schemas

---

## Notes for Implementation

1. **Environment Setup:** Copy `.env.example` to `.env` and set `DATABASE_URL` before running migrations.

2. **Database:** Ensure PostgreSQL is running locally or use a cloud provider (Supabase, Neon, etc.).

3. **Development:** Use `npm run dev` for hot-reloading during development.

4. **Migrations:** Run `npm run db:push` to apply schema changes during development. Use `npm run db:generate` and `npm run db:migrate` for production migrations.

5. **Testing:** This plan includes manual testing. For automated testing, add a testing framework like Vitest and write tests for each route module.

6. **Future Multi-User:** When adding user authentication, add `user_id` foreign key to all tables and update queries to filter by current user.
