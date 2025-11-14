require('dotenv/config');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

if (!process.env.PRISMA_SCHEMA_PATH) {
  process.env.PRISMA_SCHEMA_PATH = path.join(__dirname, '../../prisma/schema.prisma');
}

const globalForPrisma = global;

const prisma =
  globalForPrisma.__prismaClient ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prismaClient = prisma;
}

module.exports = prisma;

