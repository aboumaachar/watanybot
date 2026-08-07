import type { FastifyInstance } from "fastify";
import {
  watanyAddressEngine,
  watanyCategoryEngine,
  watanyRealEstateEngine,
  watanyVehicleEngine
} from "@watany/core/shared-engines";

export async function registerSharedEnginesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/engines/address/governorates", async () => ({ ok: true, data: watanyAddressEngine.listGovernorates() }));

  app.get("/api/engines/address/cazas", async (request) => {
    const query = request.query as { governorateId?: string };
    return { ok: true, data: watanyAddressEngine.listCazas(query.governorateId) };
  });

  app.get("/api/engines/address/municipalities", async (request) => {
    const query = request.query as { cazaId?: string };
    return { ok: true, data: watanyAddressEngine.listMunicipalities(query.cazaId) };
  });

  app.get("/api/engines/address/villages", async (request) => {
    const query = request.query as { cazaId?: string; municipalityId?: string };
    return { ok: true, data: watanyAddressEngine.listVillages(query) };
  });

  app.get("/api/engines/vehicles/types", async () => ({ ok: true, data: watanyVehicleEngine.listTypes() }));
  app.get("/api/engines/vehicles/makes", async () => ({ ok: true, data: watanyVehicleEngine.listMakes() }));

  app.get("/api/engines/vehicles/models", async (request) => {
    const query = request.query as { makeId?: string };
    return { ok: true, data: watanyVehicleEngine.listModels(query.makeId) };
  });

  app.get("/api/engines/real-estate/types", async () => ({ ok: true, data: watanyRealEstateEngine.listPropertyTypes() }));
  app.get("/api/engines/real-estate/deal-types", async () => ({ ok: true, data: watanyRealEstateEngine.listDealTypes() }));

  app.get("/api/engines/categories", async (request) => {
    const query = request.query as { domain?: Parameters<typeof watanyCategoryEngine.list>[0] };
    return { ok: true, data: watanyCategoryEngine.list(query.domain) };
  });
}
