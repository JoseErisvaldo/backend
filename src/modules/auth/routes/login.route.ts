import { Router } from 'express'
import { asyncHandler } from '../../../shared/async-handler'
import { loginController } from '../controller/login.controller'

export const loginRoute = Router()
loginRoute.post('/login', asyncHandler(loginController))
