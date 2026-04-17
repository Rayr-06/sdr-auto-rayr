import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig, Pool } from '@neondatabase/serverless'

function createPrismaClient() {
  // On Cloudflare Workers, use the Neon serverless adapter
  if (process.env.DATABASE_URL?.startsWith('postgresql')) {
    try {
      // In edge/workers environment, use WebSocket-based connection
      const connectionString = process.env.DATABASE_URL!
      const pool = new Pool({ connectionString })
      const adapter = new PrismaNeon(pool)
      return new PrismaClient({ adapter } as any)
    } catch {
      // Fallback to standard client
      return new PrismaClient()
    }
  }
  // Local SQLite
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
