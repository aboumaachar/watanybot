# KB Import Route Registration

The APEX script created the route plugin at:

```txt
apps/gateway-api/src/routes/kb-import.ts
```

Register it in the same gateway bootstrap file where routes such as `admin-kb-studio`, `admin-ai`, `mcp`, `recruitment`, or `jobs` are registered.

Typical Fastify registration snippet:

```ts
import registerKbImportRoutes from "./routes/kb-import";

await app.register(registerKbImportRoutes);
```

If the bootstrap uses a different Fastify variable name, keep the same pattern and change `app` to that variable.

For upload support, register multipart before the route:

```ts
import multipart from "@fastify/multipart";

await app.register(multipart, {
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
});
```

Smoke test after registration:

```bash
curl http://localhost:4000/api/admin/kb-import/health
```

Raw import smoke test:

```bash
curl -X POST http://localhost:4000/api/admin/kb-import/raw \
  -H "Content-Type: application/json" \
  --data "{\"sourceName\":\"manual recruitment sample\",\"categoryHint\":\"recruitment\",\"rawText\":\"Recruitment announcement deadline documents contact\"}"
```