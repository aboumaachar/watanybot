import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { NetworkFamilyTier, NetworkProfile, NetworkSettings, NetworkVisibilityLevel } from './network-types';

export const defaultNetworkSettings: NetworkSettings = {
  featureEnabled: true,
  requireApproval: true,
  defaultVisibilityLevel: 'VISIBLE_CAZA_ONLY',
  gpsEnabled: true,
  mapEnabled: true,
  connectionsEnabled: false,
};

type NetworkStore = {
  profiles: NetworkProfile[];
};

type UpsertNetworkMembershipInput = {
  userId: string;
  displayName: string;
  address?: unknown;
  visibilityLevel: NetworkVisibilityLevel;
  familyTier: NetworkFamilyTier;
  points: number;
  isVerifiedUser?: boolean;
};

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function storePath(): string {
  const cwd = process.cwd();
  const base = path.basename(cwd).toLowerCase() === 'gateway-api' ? cwd : path.join(cwd, 'apps', 'gateway-api');
  return path.join(base, 'data', 'network', 'network-store.json');
}

async function readStore(): Promise<NetworkStore> {
  try {
    const raw = await fs.readFile(storePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<NetworkStore>;
    return { profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [] };
  } catch {
    return { profiles: [] };
  }
}

async function writeStore(store: NetworkStore): Promise<void> {
  const file = storePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function normalizeAddress(value: unknown): NetworkProfile['address'] {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const input = value as Record<string, unknown>;
  const governorateId = normalizeText(input.governorateId || input.governorate || input.mohafaza || input.muhafaza);
  const cazaId = normalizeText(input.cazaId || input.caza);
  const municipalityId = normalizeText(input.municipalityId || input.municipality);
  const villageId = normalizeText(input.villageId || input.village || input.city || input.display_name);
  const latitude = Number(input.latitude ?? input.lat);
  const longitude = Number(input.longitude ?? input.lng ?? input.lon);

  return {
    governorateId: governorateId || undefined,
    cazaId: cazaId || undefined,
    municipalityId: municipalityId || undefined,
    villageId: villageId || undefined,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
  };
}

function findByUserId(profiles: NetworkProfile[], userId: string): NetworkProfile | undefined {
  return profiles.find((profile) => profile.userId === userId);
}

export function getNetworkSettings(): NetworkSettings {
  return defaultNetworkSettings;
}

export async function getNetworkMembership(userId: string): Promise<NetworkProfile | null> {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) return null;

  const store = await readStore();
  return findByUserId(store.profiles, normalizedUserId) ?? null;
}

export async function saveDraftNetworkMembership(input: UpsertNetworkMembershipInput): Promise<NetworkProfile> {
  const nowIso = new Date().toISOString();
  const store = await readStore();
  const existing = findByUserId(store.profiles, input.userId);

  const nextProfile: NetworkProfile = {
    id: existing?.id || randomUUID(),
    userId: input.userId,
    displayName: normalizeText(input.displayName) || existing?.displayName || 'عضو الشبكة',
    address: normalizeAddress(input.address ?? existing?.address),
    visibilityLevel: input.visibilityLevel,
    familyTier: input.familyTier,
    points: Number.isFinite(input.points) ? input.points : 0,
    isVerifiedUser: input.isVerifiedUser === true,
    approvalStatus: existing?.approvalStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
    isActive: true,
    createdAt: existing?.createdAt || nowIso,
    submittedAt: existing?.submittedAt,
    approvedAt: existing?.approvedAt,
    updatedAt: nowIso,
  };

  const nextProfiles = store.profiles.filter((profile) => profile.userId !== input.userId);
  nextProfiles.unshift(nextProfile);
  await writeStore({ profiles: nextProfiles });
  return nextProfile;
}

export async function submitNetworkMembership(userId: string): Promise<NetworkProfile | null> {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) return null;

  const store = await readStore();
  const existing = findByUserId(store.profiles, normalizedUserId);
  if (!existing) return null;

  const nowIso = new Date().toISOString();
  const next: NetworkProfile = {
    ...existing,
    approvalStatus: 'PENDING',
    submittedAt: nowIso,
    updatedAt: nowIso,
  };

  const nextProfiles = store.profiles.map((profile) => profile.userId === normalizedUserId ? next : profile);
  await writeStore({ profiles: nextProfiles });
  return next;
}

export async function approveNetworkMembership(userId: string): Promise<NetworkProfile | null> {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) return null;

  const store = await readStore();
  const existing = findByUserId(store.profiles, normalizedUserId);
  if (!existing) return null;

  const nowIso = new Date().toISOString();
  const next: NetworkProfile = {
    ...existing,
    approvalStatus: 'APPROVED',
    approvedAt: nowIso,
    isActive: true,
    updatedAt: nowIso,
  };

  const nextProfiles = store.profiles.map((profile) => profile.userId === normalizedUserId ? next : profile);
  await writeStore({ profiles: nextProfiles });
  return next;
}

export async function listNetworkProfiles(): Promise<NetworkProfile[]> {
  const store = await readStore();
  return store.profiles.filter((profile) => profile.isActive && profile.approvalStatus === 'APPROVED');
}

export async function searchNetworkProfiles(filters: { governorateId?: string; cazaId?: string; municipalityId?: string; villageId?: string }): Promise<NetworkProfile[]> {
  const profiles = await listNetworkProfiles();
  return profiles.filter((profile) => {
    if (filters.governorateId && profile.address.governorateId !== filters.governorateId) return false;
    if (filters.cazaId && profile.address.cazaId !== filters.cazaId) return false;
    if (filters.municipalityId && profile.address.municipalityId !== filters.municipalityId) return false;
    if (filters.villageId && profile.address.villageId !== filters.villageId) return false;
    return true;
  });
}