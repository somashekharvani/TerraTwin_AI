import { PrismaClient } from '@prisma/client';

// Shared database connection instance to prevent circular dependencies
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db',
    },
  },
});
