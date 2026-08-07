// Wave12 equipment/certification/veteran metadata registries for freelancer marketplace matching.
import type { FreelancerCertificationItem, FreelancerEquipmentItem } from "./civilian-jobs.freelancer-marketplace.types";

export const freelancerEquipmentRegistry: FreelancerEquipmentItem[] = [
  { id: "vehicle_van", labelAr: "فان", labelEn: "Van", category: "VEHICLE" },
  { id: "vehicle_pickup", labelAr: "بيك أب", labelEn: "Pickup", category: "VEHICLE" },
  { id: "vehicle_truck", labelAr: "شاحنة", labelEn: "Truck", category: "VEHICLE" },
  { id: "tool_generator", labelAr: "مولد", labelEn: "Generator", category: "TOOLS" },
  { id: "tool_ladder", labelAr: "سلم", labelEn: "Ladder", category: "TOOLS" },
  { id: "tool_electrical", labelAr: "عدة كهرباء", labelEn: "Electrical tools", category: "TOOLS" },
  { id: "tool_plumbing", labelAr: "عدة صحية", labelEn: "Plumbing tools", category: "TOOLS" },
  { id: "tool_welding", labelAr: "معدات تلحيم", labelEn: "Welding equipment", category: "TOOLS" },
  { id: "digital_camera", labelAr: "معدات تصوير", labelEn: "Camera kit", category: "DIGITAL" },
  { id: "digital_drone", labelAr: "طائرة مسيرة", labelEn: "Drone", category: "DIGITAL" }
];

export const freelancerCertificationRegistry: FreelancerCertificationItem[] = [
  { id: "license_driving_private", labelAr: "رخصة قيادة خصوصية", labelEn: "Private driving license", category: "DRIVING" },
  { id: "license_driving_public", labelAr: "رخصة قيادة عمومية", labelEn: "Public driving license", category: "DRIVING" },
  { id: "license_heavy_vehicle", labelAr: "رخصة آليات ثقيلة", labelEn: "Heavy vehicle license", category: "DRIVING" },
  { id: "cert_first_aid", labelAr: "إسعافات أولية", labelEn: "First aid", category: "FIRST_AID" },
  { id: "cert_security", labelAr: "تدريب أمني", labelEn: "Security certification", category: "SECURITY" },
  { id: "cert_technical", labelAr: "شهادة تقنية", labelEn: "Technical certification", category: "TECHNICAL" },
  { id: "cert_military_qualification", labelAr: "مؤهل عسكري", labelEn: "Military qualification", category: "MILITARY" },
  { id: "cert_university_degree", labelAr: "شهادة جامعية", labelEn: "University degree", category: "EDUCATION" }
];

export const freelancerVeteranTags = [
  "veteran",
  "veteran_family_member",
  "former_security_personnel",
  "former_air_force_technician",
  "former_logistics_specialist",
  "former_communications_specialist",
  "military_instructor"
] as const;