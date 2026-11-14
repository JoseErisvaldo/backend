import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { env } from './config/env'
import { errorHandler } from './middlewares/error-handler'
import { authRoutes } from './modules/auth/auth.routes'
import { paymentRoutes } from './modules/payments/payment.routes'
import { productRoutes } from './modules/products/product.routes'
import { HttpError } from './shared/http-error'

export const app = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN }))
app.use(express.json({ limit: '10kb' }))
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }))
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/payments', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }))
app.use('/api/payments', paymentRoutes)
app.use((_req, _res, next) => next(new HttpError(404, 'Rota não encontrada')))
app.use(errorHandler)
