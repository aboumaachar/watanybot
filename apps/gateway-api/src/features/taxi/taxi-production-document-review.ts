export type TaxiDocumentType = "ID" | "TAXI_LICENSE" | "VEHICLE_REGISTRATION" | "INSURANCE" | "INSPECTION" | "OTHER";
export type TaxiDocumentReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export type TaxiDocumentReview = {
  id: string;
  driverId: string;
  documentType: TaxiDocumentType;
  status: TaxiDocumentReviewStatus;
  reviewedByAdminId?: string;
  reviewedAt?: string;
  rejectionReason?: string;
};

export function requiresTaxiDocumentReview(documentType: TaxiDocumentType): boolean {
  return ["ID", "TAXI_LICENSE", "VEHICLE_REGISTRATION", "INSURANCE", "INSPECTION"].includes(documentType);
}

export function canActivateTaxiDriverFromDocuments(reviews: TaxiDocumentReview[]): boolean {
  const required: TaxiDocumentType[] = ["ID", "TAXI_LICENSE", "VEHICLE_REGISTRATION"];
  return required.every((type) => reviews.some((review) => review.documentType === type && review.status === "APPROVED"));
}

export const TAXI_DOCUMENT_REVIEW_MARKER = "TAXI_DOCUMENT_REVIEW_SCAFFOLD_PRESENT";