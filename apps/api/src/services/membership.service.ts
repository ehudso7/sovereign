// ---------------------------------------------------------------------------
// Membership service implementation
// ---------------------------------------------------------------------------

import { ok, err, AppError, paginatedResult, hasPermission, canManageRole } from "@sovereign/core";
import type {
  MembershipService,
  Membership,
  CreateMembershipInput,
  User,
  OrgId,
  UserId,
  OrgRole,
  Result,
  PaginatedResult,
  PaginationParams,
} from "@sovereign/core";
import { membershipStore, userStore } from "../store/memory-store.js";
import { getAuditEmitter } from "./audit.service.js";

export class InMemoryMembershipService implements MembershipService {
  async add(input: CreateMembershipInput): Promise<Result<Membership>> {
    // Check if membership already exists
    const existing = membershipStore.getForUser(input.orgId, input.userId);
    if (existing) {
      return err(AppError.conflict("User is already a member of this organization"));
    }

    const membership = membershipStore.create({
      orgId: input.orgId,
      userId: input.userId,
      role: input.role,
      invitedBy: input.invitedBy,
      accepted: true,
    });

    const audit = getAuditEmitter();
    await audit.emit({
      orgId: input.orgId,
      actorId: input.invitedBy,
      actorType: "user",
      action: "membership.added",
      resourceType: "membership",
      resourceId: membership.id,
      metadata: { userId: input.userId, role: input.role },
    });

    return ok(membership);
  }

  async remove(orgId: OrgId, userId: UserId, actorId: UserId): Promise<Result<void>> {
    const membership = membershipStore.getForUser(orgId, userId);
    if (!membership) {
      return err(AppError.notFound("Membership"));
    }

    // Cannot remove the last org_owner
    if (membership.role === "org_owner") {
      const allMembers = membershipStore.listForOrg(orgId);
      const ownerCount = allMembers.filter((m) => m.role === "org_owner").length;
      if (ownerCount <= 1) {
        return err(AppError.badRequest("Cannot remove the last organization owner"));
      }
    }

    membershipStore.delete(orgId, userId);

    const audit = getAuditEmitter();
    await audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "membership.removed",
      resourceType: "membership",
      resourceId: membership.id,
      metadata: { removedUserId: userId },
    });

    return ok(undefined);
  }

  async changeRole(orgId: OrgId, userId: UserId, newRole: OrgRole, actorId: UserId): Promise<Result<Membership>> {
    const membership = membershipStore.getForUser(orgId, userId);
    if (!membership) {
      return err(AppError.notFound("Membership"));
    }

    // Check actor has permission to manage roles
    const actorMembership = membershipStore.getForUser(orgId, actorId);
    if (!actorMembership) {
      return err(AppError.forbidden());
    }

    if (!hasPermission(actorMembership.role, "org:manage_roles") && actorMembership.role !== "org_admin") {
      return err(AppError.forbidden("Insufficient permissions to change roles"));
    }

    // Actor must outrank the target role
    if (!canManageRole(actorMembership.role, newRole)) {
      return err(AppError.forbidden("Cannot assign a role equal to or above your own"));
    }

    // Cannot demote the last owner
    if (membership.role === "org_owner" && newRole !== "org_owner") {
      const allMembers = membershipStore.listForOrg(orgId);
      const ownerCount = allMembers.filter((m) => m.role === "org_owner").length;
      if (ownerCount <= 1) {
        return err(AppError.badRequest("Cannot demote the last organization owner"));
      }
    }

    const oldRole = membership.role;
    const updated = membershipStore.updateRole(membership.id, newRole);
    if (!updated) {
      return err(AppError.internal());
    }

    const audit = getAuditEmitter();
    await audit.emit({
      orgId,
      actorId,
      actorType: "user",
      action: "membership.role_changed",
      resourceType: "membership",
      resourceId: membership.id,
      metadata: { userId, oldRole, newRole },
    });

    return ok(updated);
  }

  async getForUser(orgId: OrgId, userId: UserId): Promise<Result<Membership>> {
    const membership = membershipStore.getForUser(orgId, userId);
    if (!membership) {
      return err(AppError.notFound("Membership"));
    }
    return ok(membership);
  }

  async listForOrg(orgId: OrgId, pagination?: PaginationParams): Promise<Result<PaginatedResult<Membership & { user: User }>>> {
    const memberships = membershipStore.listForOrg(orgId);
    const enriched: (Membership & { user: User })[] = [];
    for (const m of memberships) {
      const user = userStore.getById(m.userId);
      if (user) {
        enriched.push({ ...m, user });
      }
    }

    const limit = Math.min(pagination?.limit ?? 20, 100);
    const startIdx = pagination?.cursor ? parseInt(pagination.cursor, 10) : 0;
    const slice = enriched.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < enriched.length ? String(startIdx + limit) : undefined;

    return ok(paginatedResult(slice, enriched.length, nextCursor));
  }

  async listOrgsForUser(userId: UserId): Promise<Result<readonly Membership[]>> {
    const memberships = membershipStore.listForUser(userId);
    return ok(memberships);
  }
}
