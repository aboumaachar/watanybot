import { api } from "../../lib/api";
import type { AlWafiyatApprovalAction, AlWafiyatImportResponse, AlWafiyatNotice, AlWafiyatSourceId } from "./alWafiyat.types";

export function previewAlWafiyatImport(sourceId: AlWafiyatSourceId, limit = 6): Promise<AlWafiyatImportResponse> {
  return api.importAlWafiyatSource(sourceId, { previewOnly: true, limit });
}

export function runAlWafiyatImport(sourceId: AlWafiyatSourceId, limit = 6): Promise<AlWafiyatImportResponse> {
  return api.importAlWafiyatSource(sourceId, { limit });
}

export function decideAlWafiyatNotice(id: string, action: AlWafiyatApprovalAction): Promise<AlWafiyatNotice> {
  return api.approveAlWafiyatNotice(id, action);
}