# Expsense API Design

**Date:** 2026-05-02
**Status:** Approved
**Stack:** Hono, Scalar OpenAPI, Drizzle ORM, PostgreSQL, Zod

## Overview

A personal expense tracker API with extensible foundations for future multi-user/team support. Tracks income and expenses with categories and budgets.

## Architecture

**Modular Route-Based Approach**

- Organize by domain: `transactions/`, `categories/`, `budgets/` routes
- Each route module handles its own validation (Zod schemas) and controllers
- Drizzle queries in controller files for simplicity
- `hono-zod-openapi` for automatic OpenAPI generation
- `@scalar/hono-api-reference` for interactive documentation at `/docs`
- Easy to extract services later if business logic grows

### Project Structure

```
expsense-api-hono/
├── src/
│   ├── routes/
│   │   ├── transactions.ts   # CRUD + filtering by type/category/date
│   │   ├── categories.ts     # CRUD for categories
│   │   ├── budgets.ts        # CRUD + budget utilization check
│   │   └── index.ts          # Route aggregation
│   ├── db/
│   │   ├── schema.ts         # Drizzle schema definitions
│   │   ├── migrations/       # Auto-generated migrations
│   │   └── index.ts          # DB connection export
│   ├── lib/
│   │   ├── validator.ts      # Zod schemas
│   │   └── scalar.ts         # Scalar UI setup
│   └── index.ts              # App entry point
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

## Database Schema

### Categories Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| name | text | UNIQUE, NOT NULL |
| color | text | OPTIONAL (for UI) |
| created_at | timestamp | DEFAULT NOW() |

### Transactions Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| type | enum | 'income' OR 'expense', NOT NULL |
| amount | numeric | POSITIVE, NOT NULL |
| description | text | OPTIONAL |
| category_id | uuid | FK → categories(id) |
| occurred_at | timestamp | DEFAULT NOW() |
| created_at | timestamp | DEFAULT NOW() |

**Rationale:** Single table with `type` field simplifies calculations (net balance, filtering) and enables shared categories. Separate tables would require UNION queries and code duplication.

### Budgets Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| category_id | uuid | FK → categories(id), UNIQUE |
| amount | numeric | POSITIVE, NOT NULL |
| period | enum | 'monthly' OR 'yearly', NOT NULL |
| created_at | timestamp | DEFAULT NOW() |

**Note:** Budgets are expense-only. Income doesn't have budgets.

### Future Extensibility

For multi-user support, minimal changes needed:
1. Add `users` table with auth (Clerk, Lucia, or custom)
2. Add `user_id` FK to categories, transactions, budgets
3. Add middleware to inject current user into context
4. Update queries to filter by `user_id`

No architecture changes required.

## API Endpoints

**Base URL:** `/api`

### Categories

```
GET    /api/categories          # List all categories
POST   /api/categories          # Create category
GET    /api/categories/:id      # Get single category
PUT    /api/categories/:id      # Update category
DELETE /api/categories/:id      # Delete category
```

### Transactions

```
GET    /api/transactions        # List with filters (?type=income|expense&category_id=&from=&to=)
POST   /api/transactions        # Create transaction
GET    /api/transactions/:id    # Get single transaction
PUT    /api/transactions/:id    # Update transaction
DELETE /api/transactions/:id    # Delete transaction
```

### Budgets

```
GET    /api/budgets             # List all budgets
POST   /api/budgets             # Create budget
GET    /api/budgets/:id         # Get budget + utilization
PUT    /api/budgets/:id         # Update budget
DELETE /api/budgets/:id         # Delete budget
```

### Analytics (Bonus)

```
GET    /api/analytics/summary        # Total income, expense, net balance
GET    /api/analytics/by-category    # Breakdown by category
```

### Documentation

```
GET    /docs                   # Scalar UI (interactive API reference)
GET    /openapi.json           # OpenAPI spec
```

## Validation & Error Handling

### Zod Schema Examples

**Create Transaction:**
```typescript
{
  type: z.enum(['income', 'expense']),
  amount: z.number().positive().max(999999999),
  description: z.string().min(1).max(500).optional(),
  category_id: z.string().uuid(),
  occurred_at: z.datetime().optional()
}
```

**Create Budget:**
```typescript
{
  category_id: z.string().uuid(),
  amount: z.number().positive(),
  period: z.enum(['monthly', 'yearly'])
}
```

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "amount", "message": "Must be positive" }
    ]
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Validation errors
- `404` - Resource not found
- `409` - Conflict (duplicate category name, budget exists for category)
- `500` - Server errors

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Hono | Fast, lightweight web framework |
| Documentation | `hono-zod-openapi` + `@scalar/hono-api-reference` | Auto-generate OpenAPI + Scalar UI |
| ORM | Drizzle ORM | Type-safe SQL queries |
| Database | PostgreSQL | Relational data storage |
| Validation | Zod | Runtime type validation |
| Migration | Drizzle Kit | Schema management |

## Success Criteria

- [ ] All CRUD endpoints working for transactions, categories, budgets
- [ ] Scalar UI accessible at `/docs` with complete API reference
- [ ] Zod validation prevents invalid data
- [ ] Budgets correctly track expense utilization
- [ ] Analytics endpoints return accurate summaries
- [ ] Database migrations run successfully
- [ ] OpenAPI spec is valid and complete

## Implementation Notes

1. Use `hono-zod-openapi`'s `openApi` middleware on all routes for automatic doc generation
2. Use `drizzle-kit` for migrations: `drizzle-kit generate`, `drizzle-kit migrate`
3. Postgres.js driver for database connection (lightweight, edge-compatible)
4. Environment variables for DATABASE_URL
