import { openWatanyUniversalFormViewer } from "../../lib/watanyUniversalFormViewer";

export type SchoolAidViewerItem = {
  titleAr: string;
  previewUrl: string;
  downloadUrl?: string;
  preferUniversal?: boolean;
};

export async function openSchoolAidViewer(item: SchoolAidViewerItem) {
  return openWatanyUniversalFormViewer(item);
}