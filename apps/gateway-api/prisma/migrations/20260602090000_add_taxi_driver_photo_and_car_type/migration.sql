-- Add optional driver profile picture and public car type fields.

ALTER TABLE "TaxiDriverProfile" ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;
ALTER TABLE "TaxiVehicle" ADD COLUMN IF NOT EXISTS "carType" TEXT;