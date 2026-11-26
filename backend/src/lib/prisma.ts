import { PrismaClient } from '@prisma/client';

const rawDbUrl =
  process.env.CLUSTER_URL ||
  process.env.CLUSTER_MONGODB_URI ||
  process.env.STORAGE_MONGODB_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL;

const formattedDbUrl = rawDbUrl
  ? rawDbUrl.includes('.mongodb.net/?')
    ? rawDbUrl.replace('.mongodb.net/?', '.mongodb.net/karteevo?')
    : rawDbUrl
  : undefined;

const prisma = new PrismaClient(
  formattedDbUrl
    ? {
        datasources: {
          db: {
            url: formattedDbUrl,
          },
        },
      }
    : undefined
);

export { prisma };

