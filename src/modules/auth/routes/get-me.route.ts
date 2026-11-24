import { Router } from 'express'
import { asyncHandler } from '../../../shared/async-handler'
import { ensureAuthenticated } from '../auth.middleware'
import { getMeController } from '../controller/get-me.controller'

export const getMeRoute = Router()
getMeRoute.get('/me', ensureAuthenticated, asyncHandler(getMeController))
