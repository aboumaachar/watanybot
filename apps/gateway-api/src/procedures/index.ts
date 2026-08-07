export { proceduresRoutes } from "./routes.js";
export type { Procedure, DocRef, ProcToDocs, ProcedureHit, StoredDocAsset } from "./types.js";
export { searchProcedures, getProcedure, getProcedureByTitle, getProcedureDocs, getProcedureDoc, mapStoredDocAssetToDocRef, reloadIndex, getStats } from "./indexer.js";
