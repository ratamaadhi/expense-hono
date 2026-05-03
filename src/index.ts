// src/index.ts
import 'dotenv/config'
import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import routes from './routes/index.js'

const app = new OpenAPIHono()

app.use('/*', cors({
  origin: ['https://expense-vue.ratama.space', 'https://www.expense-vue.ratama.space'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

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
})

// Scalar UI
app.get('/docs', apiReference({
  spec: {
    url: '/openapi.json',
  },
}))

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'Expsense API is running' })
})

const port = parseInt(process.env.PORT || '3000')

console.log(`Server starting on port ${port}`)
console.log(`API docs available at http://localhost:${port}/docs`)

serve({
  fetch: app.fetch,
  port,
})
