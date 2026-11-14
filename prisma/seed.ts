import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.product.upsert({
    where: { id: 'demo-product-card-payment' },
    update: {},
    create: {
      id: 'demo-product-card-payment',
      name: 'Produto de demonstração',
      description: 'Produto inicial para testar o catálogo e o checkout.',
      price: '50.00',
      currency: 'BRL',
    },
  })
}

main()
  .catch((error: unknown) => {
    console.error('Falha ao carregar produtos iniciais:', error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
