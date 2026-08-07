import type { WatanyAddressCatalog } from "./address.types";

export const WATANY_ADDRESS_CATALOG_SEED: WatanyAddressCatalog = {
  governorates: [
    { id: "beirut", nameAr: "بيروت", nameEn: "Beirut", sortOrder: 10 },
    { id: "mount-lebanon", nameAr: "جبل لبنان", nameEn: "Mount Lebanon", sortOrder: 20 },
    { id: "north", nameAr: "الشمال", nameEn: "North", sortOrder: 30 },
    { id: "akkar", nameAr: "عكار", nameEn: "Akkar", sortOrder: 40 },
    { id: "bekaa", nameAr: "البقاع", nameEn: "Bekaa", sortOrder: 50 },
    { id: "baalbek-hermel", nameAr: "بعلبك الهرمل", nameEn: "Baalbek-Hermel", sortOrder: 60 },
    { id: "south", nameAr: "الجنوب", nameEn: "South", sortOrder: 70 },
    { id: "nabatieh", nameAr: "النبطية", nameEn: "Nabatieh", sortOrder: 80 }
  ],
  cazas: [
    { id: "beirut-caza", governorateId: "beirut", nameAr: "بيروت", nameEn: "Beirut", sortOrder: 10 },
    { id: "baabda", governorateId: "mount-lebanon", nameAr: "بعبدا", nameEn: "Baabda", sortOrder: 10 },
    { id: "metn", governorateId: "mount-lebanon", nameAr: "المتن", nameEn: "Metn", sortOrder: 20 },
    { id: "keserwan", governorateId: "mount-lebanon", nameAr: "كسروان", nameEn: "Keserwan", sortOrder: 30 },
    { id: "tripoli", governorateId: "north", nameAr: "طرابلس", nameEn: "Tripoli", sortOrder: 10 },
    { id: "saida", governorateId: "south", nameAr: "صيدا", nameEn: "Saida", sortOrder: 10 },
    { id: "nabatieh-caza", governorateId: "nabatieh", nameAr: "النبطية", nameEn: "Nabatieh", sortOrder: 10 }
  ],
  municipalities: [
    { id: "beirut-municipality", cazaId: "beirut-caza", nameAr: "بلدية بيروت", nameEn: "Beirut Municipality", sortOrder: 10 },
    { id: "baabda-municipality", cazaId: "baabda", nameAr: "بلدية بعبدا", nameEn: "Baabda Municipality", sortOrder: 10 },
    { id: "jounieh-municipality", cazaId: "keserwan", nameAr: "بلدية جونية", nameEn: "Jounieh Municipality", sortOrder: 10 },
    { id: "saida-municipality", cazaId: "saida", nameAr: "بلدية صيدا", nameEn: "Saida Municipality", sortOrder: 10 }
  ],
  villages: [
    { id: "beirut-village", cazaId: "beirut-caza", municipalityId: "beirut-municipality", nameAr: "بيروت", nameEn: "Beirut", sortOrder: 10 },
    { id: "baabda-village", cazaId: "baabda", municipalityId: "baabda-municipality", nameAr: "بعبدا", nameEn: "Baabda", sortOrder: 10 },
    { id: "jounieh-village", cazaId: "keserwan", municipalityId: "jounieh-municipality", nameAr: "جونية", nameEn: "Jounieh", sortOrder: 10 },
    { id: "saida-village", cazaId: "saida", municipalityId: "saida-municipality", nameAr: "صيدا", nameEn: "Saida", sortOrder: 10 }
  ]
};
