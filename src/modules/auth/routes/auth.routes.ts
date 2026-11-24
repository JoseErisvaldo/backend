import { Router } from 'express'
import { getMeRoute } from './get-me.route'
import { loginRoute } from './login.route'
import { registerRoute } from './register.route'

export const authRoutes = Router()
authRoutes.use(registerRoute, loginRoute, getMeRoute)
