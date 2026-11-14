import { app } from './app'
import { env } from './config/env'
import { prisma } from './shared/prisma'

const server = app.listen(env.PORT, () => {
  console.log(`API disponível em http://localhost:${env.PORT}`)
})

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
