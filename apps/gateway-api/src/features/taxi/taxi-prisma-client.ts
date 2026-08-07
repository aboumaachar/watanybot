// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

let prismaClient: PrismaClient | null = null;

export function getTaxiPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;

  if (!prismaClient) {
    try {
      // @prisma/client is only available when the DB layer is provisioned.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaClient: PC } = require('@prisma/client') as { PrismaClient: new () => PrismaClient };
      prismaClient = new PC();
    } catch {
      return null;
    }
  }
  return prismaClient;
}
