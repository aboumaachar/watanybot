import { getSchoolAidRequiredItem, schoolAidRequiredItems } from "../data/school-aids-required-items";

type FastifyLike = {
  get: (route: string, handler: (req: any, reply: any) => Promise<any> | any) => void;
};

export function registerSchoolAidsRoutes(app: FastifyLike) {
  app.get("/api/school-aids/items", async (_req, reply) => {
    return reply.send({
      feature: "school_aids",
      titleAr: "المنح المدرسية",
      items: schoolAidRequiredItems,
      forms: schoolAidRequiredItems.filter((item) => item.type === "FORM"),
      guides: schoolAidRequiredItems.filter((item) => item.type === "GUIDE"),
      count: schoolAidRequiredItems.length,
    });
  });

  app.get("/api/school-aids/items/:itemId", async (req: any, reply: any) => {
    const item = getSchoolAidRequiredItem(req.params.itemId);
    if (!item) return reply.status(404).send({ error: "SCHOOL_AID_ITEM_NOT_FOUND" });
    return reply.send({ item });
  });

  app.get("/api/school-aids/conditions", async (_req, reply) => {
    return reply.send({ item: getSchoolAidRequiredItem("school-aid-papers-conditions") });
  });
}

