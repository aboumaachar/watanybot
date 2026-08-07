declare module "node:crypto" {
  const crypto: {
    createHash(algorithm: string): {
      update(value: string, encoding: "utf8"): { digest(encoding: "hex"): string };
    };
  };

  export default crypto;
}
