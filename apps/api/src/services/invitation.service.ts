// ---------------------------------------------------------------------------
// Invitation service implementation
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type {
  InvitationService,
  Invitation,
  CreateInvitationInput,
  Membership,
  OrgId,
  UserId,
  Result,
} from "@sovereign/core";
import { invitationStore, membershipStore, userStore } from "../store/memory-store.js";
import { getAuditEmitter } from "./audit.service.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class InMemoryInvitationService implements InvitationService {
  async create(input: CreateInvitationInput): Promise<Result<Invitation>> {
    // Check if user already a member
    const existingUser = userStore.getByEmail(input.email);
    if (existingUser) {
      const existingMembership = membershipStore.getForUser(input.orgId, existingUser.id);
      if (existingMembership) {
        return err(AppError.conflict("User is already a member of this organization"));
      }
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
    const invitation = invitationStore.create({
      orgId: input.orgId,
      email: input.email,
      role: input.role,
      invitedBy: input.invitedBy,
      expiresAt,
    });

    const audit = getAuditEmitter();
    await audit.emit({
      orgId: input.orgId,
      actorId: input.invitedBy,
      actorType: "user",
      action: "invitation.created",
      resourceType: "invitation",
      resourceId: invitation.id,
      metadata: { email: input.email, role: input.role },
    });

    return ok(invitation);
  }

  async accept(invitationId: string, userId: UserId): Promise<Result<Membership>> {
    const invitation = invitationStore.getById(invitationId);
    if (!invitation) {
      return err(AppError.notFound("Invitation", invitationId));
    }

    if (invitation.acceptedAt) {
      return err(AppError.conflict("Invitation already accepted"));
    }

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      return err(AppError.badRequest("Invitation has expired"));
    }

    // Verify the user's email matches the invitation
    const user = userStore.getById(userId);
    if (!user || user.email !== invitation.email) {
      return err(AppError.forbidden("This invitation is not for your email address"));
    }

    invitationStore.accept(invitationId);

    const membership = membershipStore.create({
      orgId: invitation.orgId,
      userId,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      accepted: true,
    });

    const audit = getAuditEmitter();
    await audit.emit({
      orgId: invitation.orgId,
      actorId: userId,
      actorType: "user",
      action: "invitation.accepted",
      resourceType: "invitation",
      resourceId: invitation.id,
      metadata: { membershipId: membership.id },
    });

    return ok(membership);
  }

  async listForOrg(orgId: OrgId): Promise<Result<readonly Invitation[]>> {
    const invitations = invitationStore.listForOrg(orgId);
    return ok(invitations);
  }

  async revoke(invitationId: string, orgId: OrgId): Promise<Result<void>> {
    const invitation = invitationStore.getById(invitationId);
    if (!invitation || invitation.orgId !== orgId) {
      return err(AppError.notFound("Invitation", invitationId));
    }
    invitationStore.delete(invitationId);
    return ok(undefined);
  }
}
