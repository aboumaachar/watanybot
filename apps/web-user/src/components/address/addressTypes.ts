export type LebanonAddressValue = Readonly<{
  mohafaza: string;
  qaza: string;
  village: string;
  exactAddress?: string;
  displayAddress: string;
  source?: string;
  status?: string;
  governorateId?: string;
  districtOrEquivalentId?: string;
  localityId?: string;
  localityPcode?: string;
  locationDatasetVersion?: string;
  locationApprovalStatus?: string;
}>;

export type LebanonAddressRow = Readonly<{
  mohafaza: string;
  qaza: string;
  village: string;
  displayName?: string;
  source?: string;
  status?: string;
  governorateId?: string;
  districtOrEquivalentId?: string;
  localityId?: string;
  localityPcode?: string;
}>;

export type LebanonAddressValidationResult = Readonly<{
  ok: boolean;
  value: LebanonAddressValue;
  issues: string[];
}>;