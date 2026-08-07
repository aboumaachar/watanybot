import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    kb: any;
  }
}
