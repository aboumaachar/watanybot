-- CreateEnum
CREATE TYPE "TaxiDriverStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "TaxiVerificationLevel" AS ENUM ('BASIC', 'LICENSED', 'TRUSTED');

-- CreateEnum
CREATE TYPE "TaxiDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TaxiAvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "TaxiReservationStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DRIVER_CALLED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "TaxiCallType" AS ENUM ('DIRECT_PHONE', 'WHATSAPP', 'IN_APP_REQUEST');

-- CreateEnum
CREATE TYPE "TaxiAuditAction" AS ENUM ('DRIVER_APPLIED', 'DRIVER_APPROVED', 'DRIVER_REJECTED', 'DRIVER_SUSPENDED', 'AVAILABILITY_CHANGED', 'RESERVATION_CREATED', 'RESERVATION_ACCEPTED', 'RESERVATION_CANCELLED', 'DOCUMENT_SUBMITTED', 'DOCUMENT_REVIEWED', 'OTP_REQUESTED', 'OTP_VERIFIED');

-- CreateEnum
CREATE TYPE "TaxiOtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "TaxiDriverProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappPhone" TEXT,
    "status" "TaxiDriverStatus" NOT NULL DEFAULT 'PENDING',
    "verificationLevel" "TaxiVerificationLevel" NOT NULL DEFAULT 'BASIC',
    "otpVerified" BOOLEAN NOT NULL DEFAULT false,
    "publicVisible" BOOLEAN NOT NULL DEFAULT false,
    "documentReviewStatus" "TaxiDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxiDriverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiVehicle" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "color" TEXT,
    "plateNumberEncrypted" TEXT,
    "platePublicLastDigits" TEXT,
    "plateType" TEXT,
    "seats" INTEGER,
    "hasInsurance" BOOLEAN NOT NULL DEFAULT false,
    "hasInspection" BOOLEAN NOT NULL DEFAULT false,
    "hasFireExtinguisher" BOOLEAN NOT NULL DEFAULT false,
    "status" "TaxiDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxiVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiDriverDocument" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileRef" TEXT,
    "storageKey" TEXT,
    "status" "TaxiDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxiDriverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiServiceArea" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "muhafaza" TEXT,
    "caza" TEXT,
    "village" TEXT,
    "label" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxiServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiAvailability" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "TaxiAvailabilityStatus" NOT NULL DEFAULT 'OFFLINE',
    "locationLabel" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "availableUntil" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxiAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiReservation" (
    "id" TEXT NOT NULL,
    "riderUserId" TEXT,
    "riderPhone" TEXT,
    "driverId" TEXT NOT NULL,
    "pickupText" TEXT NOT NULL,
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "destinationText" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "status" "TaxiReservationStatus" NOT NULL DEFAULT 'REQUESTED',
    "priceAgreementText" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxiReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiCallEvent" (
    "id" TEXT NOT NULL,
    "riderUserId" TEXT,
    "driverId" TEXT,
    "reservationId" TEXT,
    "callType" "TaxiCallType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxiCallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiReviewOrComplaint" (
    "id" TEXT NOT NULL,
    "riderUserId" TEXT,
    "driverId" TEXT NOT NULL,
    "reservationId" TEXT,
    "type" TEXT NOT NULL,
    "rating" INTEGER,
    "text" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxiReviewOrComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiAuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "driverId" TEXT,
    "action" "TaxiAuditAction" NOT NULL,
    "detailJson" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxiAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxiOtpChallenge" (
    "id" TEXT NOT NULL,
    "driverId" TEXT,
    "phone" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" "TaxiOtpStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxiOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxiDriverProfile_status_publicVisible_idx" ON "TaxiDriverProfile"("status", "publicVisible");

-- CreateIndex
CREATE INDEX "TaxiDriverProfile_phone_idx" ON "TaxiDriverProfile"("phone");

-- CreateIndex
CREATE INDEX "TaxiDriverProfile_userId_idx" ON "TaxiDriverProfile"("userId");

-- CreateIndex
CREATE INDEX "TaxiVehicle_driverId_idx" ON "TaxiVehicle"("driverId");

-- CreateIndex
CREATE INDEX "TaxiVehicle_status_idx" ON "TaxiVehicle"("status");

-- CreateIndex
CREATE INDEX "TaxiDriverDocument_driverId_status_idx" ON "TaxiDriverDocument"("driverId", "status");

-- CreateIndex
CREATE INDEX "TaxiDriverDocument_documentType_idx" ON "TaxiDriverDocument"("documentType");

-- CreateIndex
CREATE INDEX "TaxiServiceArea_driverId_idx" ON "TaxiServiceArea"("driverId");

-- CreateIndex
CREATE INDEX "TaxiServiceArea_muhafaza_caza_village_idx" ON "TaxiServiceArea"("muhafaza", "caza", "village");

-- CreateIndex
CREATE INDEX "TaxiAvailability_driverId_status_idx" ON "TaxiAvailability"("driverId", "status");

-- CreateIndex
CREATE INDEX "TaxiAvailability_lastSeenAt_idx" ON "TaxiAvailability"("lastSeenAt");

-- CreateIndex
CREATE INDEX "TaxiReservation_driverId_status_idx" ON "TaxiReservation"("driverId", "status");

-- CreateIndex
CREATE INDEX "TaxiReservation_riderUserId_idx" ON "TaxiReservation"("riderUserId");

-- CreateIndex
CREATE INDEX "TaxiReservation_scheduledAt_idx" ON "TaxiReservation"("scheduledAt");

-- CreateIndex
CREATE INDEX "TaxiCallEvent_driverId_idx" ON "TaxiCallEvent"("driverId");

-- CreateIndex
CREATE INDEX "TaxiCallEvent_reservationId_idx" ON "TaxiCallEvent"("reservationId");

-- CreateIndex
CREATE INDEX "TaxiCallEvent_createdAt_idx" ON "TaxiCallEvent"("createdAt");

-- CreateIndex
CREATE INDEX "TaxiReviewOrComplaint_driverId_status_idx" ON "TaxiReviewOrComplaint"("driverId", "status");

-- CreateIndex
CREATE INDEX "TaxiReviewOrComplaint_reservationId_idx" ON "TaxiReviewOrComplaint"("reservationId");

-- CreateIndex
CREATE INDEX "TaxiAuditEvent_driverId_idx" ON "TaxiAuditEvent"("driverId");

-- CreateIndex
CREATE INDEX "TaxiAuditEvent_action_idx" ON "TaxiAuditEvent"("action");

-- CreateIndex
CREATE INDEX "TaxiAuditEvent_createdAt_idx" ON "TaxiAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "TaxiOtpChallenge_phone_purpose_status_idx" ON "TaxiOtpChallenge"("phone", "purpose", "status");

-- CreateIndex
CREATE INDEX "TaxiOtpChallenge_driverId_idx" ON "TaxiOtpChallenge"("driverId");

-- CreateIndex
CREATE INDEX "TaxiOtpChallenge_expiresAt_idx" ON "TaxiOtpChallenge"("expiresAt");

-- AddForeignKey
ALTER TABLE "TaxiVehicle" ADD CONSTRAINT "TaxiVehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TaxiDriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiDriverDocument" ADD CONSTRAINT "TaxiDriverDocument_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TaxiDriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiServiceArea" ADD CONSTRAINT "TaxiServiceArea_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TaxiDriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiAvailability" ADD CONSTRAINT "TaxiAvailability_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TaxiDriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiReservation" ADD CONSTRAINT "TaxiReservation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TaxiDriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiCallEvent" ADD CONSTRAINT "TaxiCallEvent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TaxiDriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiCallEvent" ADD CONSTRAINT "TaxiCallEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "TaxiReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiReviewOrComplaint" ADD CONSTRAINT "TaxiReviewOrComplaint_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TaxiDriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiReviewOrComplaint" ADD CONSTRAINT "TaxiReviewOrComplaint_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "TaxiReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiAuditEvent" ADD CONSTRAINT "TaxiAuditEvent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TaxiDriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxiOtpChallenge" ADD CONSTRAINT "TaxiOtpChallenge_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TaxiDriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
