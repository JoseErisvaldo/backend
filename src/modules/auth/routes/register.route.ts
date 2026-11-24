import { Router } from 'express'
import { asyncHandler } from '../../../shared/async-handler'
import { registerController } from '../controller/register.controller'

export const registerRoute = Router()
registerRoute.post('/register', asyncHandler(registerController))
