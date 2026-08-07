import type { WatanyVehicleMake, WatanyVehicleModel, WatanyVehicleSelection, WatanyVehicleType } from "./vehicle.types";

export const WATANY_VEHICLE_TYPES: WatanyVehicleType[] = [
  { id: "car", nameAr: "سيارة", nameEn: "Car", sortOrder: 10 },
  { id: "taxi", nameAr: "تاكسي", nameEn: "Taxi", sortOrder: 20 },
  { id: "van", nameAr: "فان", nameEn: "Van", sortOrder: 30 },
  { id: "motorcycle", nameAr: "دراجة نارية", nameEn: "Motorcycle", sortOrder: 40 },
  { id: "truck", nameAr: "شاحنة", nameEn: "Truck", sortOrder: 50 }
];

export const WATANY_VEHICLE_MAKES: WatanyVehicleMake[] = [
  { id: "toyota", nameAr: "تويوتا", nameEn: "Toyota", sortOrder: 10 },
  { id: "nissan", nameAr: "نيسان", nameEn: "Nissan", sortOrder: 20 },
  { id: "hyundai", nameAr: "هيونداي", nameEn: "Hyundai", sortOrder: 30 },
  { id: "kia", nameAr: "كيا", nameEn: "Kia", sortOrder: 40 },
  { id: "mercedes", nameAr: "مرسيدس", nameEn: "Mercedes-Benz", sortOrder: 50 }
];

export const WATANY_VEHICLE_MODELS: WatanyVehicleModel[] = [
  { id: "corolla", makeId: "toyota", nameAr: "كورولا", nameEn: "Corolla", sortOrder: 10 },
  { id: "yaris", makeId: "toyota", nameAr: "ياريس", nameEn: "Yaris", sortOrder: 20 },
  { id: "sunny", makeId: "nissan", nameAr: "صني", nameEn: "Sunny", sortOrder: 10 },
  { id: "elantra", makeId: "hyundai", nameAr: "إلنترا", nameEn: "Elantra", sortOrder: 10 },
  { id: "sportage", makeId: "kia", nameAr: "سبورتاج", nameEn: "Sportage", sortOrder: 10 }
];

function bySort<T extends { sortOrder: number; nameAr: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, "ar"));
}

export class WatanyVehicleEngine {
  listTypes(): WatanyVehicleType[] {
    return bySort(WATANY_VEHICLE_TYPES);
  }

  listMakes(): WatanyVehicleMake[] {
    return bySort(WATANY_VEHICLE_MAKES);
  }

  listModels(makeId?: string): WatanyVehicleModel[] {
    const items = makeId ? WATANY_VEHICLE_MODELS.filter((item) => item.makeId === makeId) : WATANY_VEHICLE_MODELS;
    return bySort(items);
  }

  toDisplay(selection: WatanyVehicleSelection): string {
    const type = WATANY_VEHICLE_TYPES.find((item) => item.id === selection.typeId);
    const make = WATANY_VEHICLE_MAKES.find((item) => item.id === selection.makeId);
    const model = WATANY_VEHICLE_MODELS.find((item) => item.id === selection.modelId);
    return [type?.nameAr, make?.nameAr, model?.nameAr, selection.year].filter(Boolean).join(" / ") || "غير محدد";
  }
}

export const watanyVehicleEngine = new WatanyVehicleEngine();
