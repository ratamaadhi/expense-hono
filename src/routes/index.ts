// src/routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import categories from './categories.js'
import transactions from './transactions.js'

const app = new OpenAPIHono()

app.route('/categories', categories)
app.route('/transactions', transactions)

export default app
