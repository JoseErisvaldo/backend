import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { Role } from '@prisma/client'
import { ensureAuthenticated, ensureRoles } from '../../auth/auth.middleware'
import { asyncHandler } from '../../../shared/async-handler'
import { subscriptionController } from '../controller/subscription.controller'

export const subscriptionRoutes = Router()

subscriptionRoutes.post('/webhook', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), asyncHandler(subscriptionController.webhook))
subscriptionRoutes.get('/plans', asyncHandler(subscriptionController.listPublicPlans))
subscriptionRoutes.get('/admin/plans', ensureAuthenticated, ensureRoles(Role.ADMIN, Role.MODERATOR), asyncHandler(subscriptionController.listAdminPlans))
subscriptionRoutes.post('/admin/plans', ensureAuthenticated, ensureRoles(Role.ADMIN, Role.MODERATOR), asyncHandler(subscriptionController.createPlan))
subscriptionRoutes.patch('/admin/plans/:id', ensureAuthenticated, ensureRoles(Role.ADMIN, Role.MODERATOR), asyncHandler(subscriptionController.updatePlan))
subscriptionRoutes.delete('/admin/plans/:id', ensureAuthenticated, ensureRoles(Role.ADMIN, Role.MODERATOR), asyncHandler(subscriptionController.deactivatePlan))
subscriptionRoutes.get('/admin/dashboard', ensureAuthenticated, ensureRoles(Role.ADMIN, Role.MODERATOR), asyncHandler(subscriptionController.getAdminSubscriptionsDashboard))
subscriptionRoutes.get('/admin', ensureAuthenticated, ensureRoles(Role.ADMIN, Role.MODERATOR), asyncHandler(subscriptionController.listAllSubscriptions))
subscriptionRoutes.get('/admin/customers', ensureAuthenticated, ensureRoles(Role.ADMIN, Role.MODERATOR), asyncHandler(subscriptionController.listAdminCustomers))
subscriptionRoutes.get('/admin/customers/dashboard', ensureAuthenticated, ensureRoles(Role.ADMIN, Role.MODERATOR), asyncHandler(subscriptionController.getAdminCustomerDashboard))
subscriptionRoutes.get('/admin/customers/:id', ensureAuthenticated, ensureRoles(Role.ADMIN, Role.MODERATOR), asyncHandler(subscriptionController.getAdminCustomerDetails))
subscriptionRoutes.get('/mine', ensureAuthenticated, asyncHandler(subscriptionController.listUserSubscriptions))
subscriptionRoutes.post('/mine', ensureAuthenticated, asyncHandler(subscriptionController.createSubscription))
subscriptionRoutes.post('/mine/:id/cancel', ensureAuthenticated, asyncHandler(subscriptionController.cancelUserSubscription))
