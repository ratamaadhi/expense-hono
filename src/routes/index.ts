// src/routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import categories from './categories.js'
import transactions from './transactions.js'
import budgets from './budgets.js'
import analytics from './analytics.js'

const app = new OpenAPIHono()

// Debugging middleware
app.use('/*', async (c, next) => {
  console.log('[CORS Debug]', {
    method: c.req.method,
    path: c.req.path,
    origin: c.req.header('origin'),
    referer: c.req.header('referer'),
    userAgent: c.req.header('user-agent'),
  })
  await next()
})

// Apply CORS to API routes
app.use('/*', cors({
  origin: [
    'https://expense-vue.ratama.space',
    'https://www.expense-vue.ratama.space',
    // Add localhost for testing
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:5173',
  ],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/categories', categories)
app.route('/transactions', transactions)
app.route('/budgets', budgets)
app.route('/analytics', analytics)

export default app
