import { WATANY_ADDRESS_CATALOG_SEED } from "./address.data";
import type {
  WatanyAddressCatalog,
  WatanyAddressDisplay,
  WatanyAddressSelection,
  WatanyCaza,
  WatanyGovernorate,
  WatanyMunicipality,
  WatanyVillage
} from "./address.types";

function bySort<T extends { sortOrder: number; nameAr: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, "ar"));
}

export class WatanyAddressEngine {
  private readonly catalog: WatanyAddressCatalog;

  constructor(catalog: WatanyAddressCatalog = WATANY_ADDRESS_CATALOG_SEED) {
    this.catalog = catalog;
  }

  listGovernorates(): WatanyGovernorate[] {
    return bySort(this.catalog.governorates);
  }

  listCazas(governorateId?: string): WatanyCaza[] {
    const items = governorateId ? this.catalog.cazas.filter((item) => item.governorateId === governorateId) : this.catalog.cazas;
    return bySort(items);
  }

  listMunicipalities(cazaId?: string): WatanyMunicipality[] {
    const items = cazaId ? this.catalog.municipalities.filter((item) => item.cazaId === cazaId) : this.catalog.municipalities;
    return bySort(items);
  }

  listVillages(filters: { cazaId?: string; municipalityId?: string } = {}): WatanyVillage[] {
    const items = this.catalog.villages.filter((item) => {
      if (filters.cazaId && item.cazaId !== filters.cazaId) return false;
      if (filters.municipalityId && item.municipalityId !== filters.municipalityId) return false;
      return true;
    });
    return bySort(items);
  }

  toDisplay(selection: WatanyAddressSelection): WatanyAddressDisplay {
    const governorate = this.catalog.governorates.find((item) => item.id === selection.governorateId);
    const caza = this.catalog.cazas.find((item) => item.id === selection.cazaId);
    const municipality = this.catalog.municipalities.find((item) => item.id === selection.municipalityId);
    const village = this.catalog.villages.find((item) => item.id === selection.villageId);

    const labelAr = [governorate?.nameAr, caza?.nameAr, municipality?.nameAr, village?.nameAr].filter(Boolean).join(" / ");
    const labelEn = [governorate?.nameEn, caza?.nameEn, municipality?.nameEn, village?.nameEn].filter(Boolean).join(" / ");

    return {
      selection,
      labelAr: labelAr || "غير محدد",
      labelEn: labelEn || undefined
    };
  }
}

export const watanyAddressEngine = new WatanyAddressEngine();
