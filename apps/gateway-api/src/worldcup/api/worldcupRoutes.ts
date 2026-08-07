import {
  getWorldCupLiveResponse,
  getWorldCupMatchResponse,
  getWorldCupStandingsResponse,
  getWorldCupTodayResponse,
} from './worldcupController';

type WorldCupRouteResponse = {
  json: (body: unknown) => unknown;
};

type WorldCupRouteRequest = {
  params: {
    id: string;
  };
};

type WorldCupRouter = {
  get: (path: string, handler: (req: any, res: WorldCupRouteResponse) => unknown) => WorldCupRouter;
};

export function registerWorldCupRoutes(router: WorldCupRouter): WorldCupRouter {
  router.get('/worldcup/today', async (_req, res) => {
    res.json(await getWorldCupTodayResponse());
  });

  router.get('/worldcup/live', async (_req, res) => {
    res.json(await getWorldCupLiveResponse());
  });

  router.get('/worldcup/standings', async (_req, res) => {
    res.json(await getWorldCupStandingsResponse());
  });

  router.get('/worldcup/match/:id', async (req: WorldCupRouteRequest, res) => {
    res.json(await getWorldCupMatchResponse(req.params.id));
  });

  return router;
}
