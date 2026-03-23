// ---------------------------------------------------------------------------
// Organization service implementation
// ---------------------------------------------------------------------------

import { ok, err, AppError, paginatedResult } from "@sovereign/core";
import type {
  OrgService,
  Organization,
  CreateOrgInput,
  UpdateOrgInput,
  OrgId,
  UserId,
  Result,
  PaginatedResult,
  PaginationParams,
} from "@sovereign/core";
import { orgStore, membershipStore } from "../store/memory-store.js";
import { getAuditEmitter } from "./audit.service.js";

export class InMemoryOrgService implements OrgService {
  async create(input: CreateOrgInput, creatorId: UserId): Promise<Result<Organization>> {
    // Check slug uniqueness
    const existing = orgStore.getBySlug(input.slug);
    if (existing) {
      return err(AppError.conflict(`Organization with slug '${input.slug}' already exists`));
    }

    const org = orgStore.create({ name: input.name, slug: input.slug });

    // Creator becomes org_owner automatically
    membershipStore.create({
      orgId: org.id,
      userId: creatorId,
      role: "org_owner",
      accepted: true,
    });

    const audit = getAuditEmitter();
    await audit.emit({
      orgId: org.id,
      actorId: creatorId,
      actorType: "user",
      action: "org.created",
      resourceType: "organization",
      resourceId: org.id,
      metadata: { name: org.name, slug: org.slug },
    });

    return ok(org);
  }

  async getById(orgId: OrgId, userId: UserId): Promise<Result<Organization>> {
    // Enforce membership check — user cannot view orgs they don't belong to
    const membership = membershipStore.getForUser(orgId, userId);
    if (!membership) {
      return err(AppError.notFound("Organization", orgId));
    }

    const org = orgStore.getById(orgId);
    if (!org) {
      return err(AppError.notFound("Organization", orgId));
    }

    return ok(org);
  }

  async update(orgId: OrgId, userId: UserId, input: UpdateOrgInput): Promise<Result<Organization>> {
    const membership = membershipStore.getForUser(orgId, userId);
    if (!membership) {
      return err(AppError.notFound("Organization", orgId));
    }

    const org = orgStore.update(orgId, input);
    if (!org) {
      return err(AppError.notFound("Organization", orgId));
    }

    const audit = getAuditEmitter();
    await audit.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "org.updated",
      resourceType: "organization",
      resourceId: orgId,
      metadata: { changes: input },
    });

    return ok(org);
  }

  async listForUser(userId: UserId, pagination?: PaginationParams): Promise<Result<PaginatedResult<Organization>>> {
    const memberships = membershipStore.listForUser(userId);
    const orgs: Organization[] = [];
    for (const m of memberships) {
      const org = orgStore.getById(m.orgId);
      if (org) orgs.push(org);
    }

    const limit = Math.min(pagination?.limit ?? 20, 100);
    const startIdx = pagination?.cursor ? parseInt(pagination.cursor, 10) : 0;
    const slice = orgs.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < orgs.length ? String(startIdx + limit) : undefined;

    return ok(paginatedResult(slice, orgs.length, nextCursor));
  }

  async checkSlugAvailable(slug: string): Promise<Result<boolean>> {
    const existing = orgStore.getBySlug(slug);
    return ok(!existing);
  }
}
