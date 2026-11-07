import { PrismaClient } from '@prisma/client';

// PrismaClient singleton for backend application services (Phase P02)
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
