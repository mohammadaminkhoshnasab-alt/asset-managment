import crypto from 'crypto';
import { prisma } from '../db/client.ts';
import type { AssetType, Location, DeviceHealth, Person } from '@prisma/client';

export interface CreatePersonInput {
  fullName: string;
  personalCode?: string | null;
  username?: string | null;
  department?: string | null;
  costCenter?: string | null;
  email?: string | null;
}

/**
 * Service for read-only lookup references and explicit person identity lookup/creation.
 */
export const lookupService = {
  /**
   * Returns active asset classification types.
   */
  async getAssetTypes(): Promise<AssetType[]> {
    return prisma.assetType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  /**
   * Returns active physical locations.
   */
  async getLocations(): Promise<Location[]> {
    return prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  /**
   * Returns active device health classification statuses.
   */
  async getDeviceHealthStatuses(): Promise<DeviceHealth[]> {
    return prisma.deviceHealth.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  /**
   * Minimal people lookup for asset assignment.
   * Avoids name-based merging; returns explicit database records.
   */
  async getPeople(params?: { search?: string; limit?: number }): Promise<Person[]> {
    const limit = Math.min(params?.limit || 50, 100);
    const search = params?.search?.trim();

    if (!search) {
      return prisma.person.findMany({
        where: { isActive: true },
        orderBy: { fullName: 'asc' },
        take: limit,
      });
    }

    return prisma.person.findMany({
      where: {
        isActive: true,
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { personalCode: { contains: search, mode: 'insensitive' } },
          { department: { contains: search, mode: 'insensitive' } },
        ],
      },
      orderBy: { fullName: 'asc' },
      take: limit,
    });
  },

  /**
   * Creates a single Person record with a server-generated UUID.
   * Enforces explicit identifiers; never merges people based on matching names.
   */
  async createPerson(input: CreatePersonInput): Promise<Person> {
    const trimmedName = input.fullName?.trim();
    if (!trimmedName) {
      throw new Error("Field 'fullName' is required and must not be empty.");
    }

    const personalCode = input.personalCode?.trim() || null;
    const username = input.username?.trim() || null;
    const department = input.department?.trim() || null;
    const costCenter = input.costCenter?.trim() || null;
    const email = input.email?.trim() || null;

    return prisma.person.create({
      data: {
        id: crypto.randomUUID(),
        fullName: trimmedName,
        personalCode,
        username,
        department,
        costCenter,
        email,
        isActive: true,
      },
    });
  },
};
