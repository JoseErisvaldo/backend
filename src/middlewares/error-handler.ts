import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../shared/http-error'

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Dados inválidos',
      errors: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    })
    return
  }
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message })
    return
  }
  console.error(error)
  res.status(500).json({ message: 'Erro interno do servidor' })
}
