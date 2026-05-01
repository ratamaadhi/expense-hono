// src/routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import categories from './categories.js'

const app = new OpenAPIHono()

app.route('/categories', categories)

export default app
