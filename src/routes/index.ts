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
