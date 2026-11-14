import { Router } from 'express'
import { authController } from './auth.controller'
import { ensureAuthenticated } from './auth.middleware'
import { asyncHandler } from '../../shared/async-handler'

export const authRoutes = Router()

authRoutes.post('/register', asyncHandler(authController.register))
authRoutes.post('/login', asyncHandler(authController.login))
authRoutes.get('/me', ensureAuthenticated, asyncHandler(authController.me))
