// ---------------------------------------------------------------------------
// Auth service — session management and authentication
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from "node:crypto";
import {
  ok,
  err,
  AppError,
  toISODateString,
} from "@sovereign/core";
import type {
  AuthService,
  AuthConfig,
  AuthResult,
  Session,
  SessionId,
  OrgId,
  UserId,
  Result,
} from "@sovereign/core";
import { userStore, sessionStore, membershipStore } from "../store/memory-store.js";
import { getAuditEmitter } from "./audit.service.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export class LocalAuthService implements AuthService {
  private readonly config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  getConfig(): AuthConfig {
    return this.config;
  }

  async signIn(email: string, _password?: string): Promise<Result<AuthResult>> {
    // In local mode, find or create user by email
    let user = userStore.getByEmail(email);
    if (!user) {
      return err(AppError.unauthorized("User not found"));
    }

    // Find the user's first membership to determine org context
    const memberships = membershipStore.listForUser(user.id);
    if (memberships.length === 0) {
      return err(AppError.unauthorized("User has no organization memberships"));
    }

    const membership = memberships[0]!;
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlMs).toISOString();

    const session = sessionStore.create({
      userId: user.id,
      orgId: membership.orgId,
      role: membership.role,
      tokenHash,
      expiresAt,
    });

    const audit = getAuditEmitter();
    await audit.emit({
      orgId: membership.orgId,
      actorId: user.id,
      actorType: "user",
      action: "auth.sign_in",
      resourceType: "session",
      resourceId: session.id,
    });

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      sessionToken: token,
      expiresAt: toISODateString(expiresAt),
    });
  }

  async signOut(sessionId: SessionId): Promise<Result<void>> {
    const session = sessionStore.getById(sessionId);
    if (!session) {
      return err(AppError.notFound("Session", sessionId));
    }

    const audit = getAuditEmitter();
    await audit.emit({
      orgId: session.orgId,
      actorId: session.userId,
      actorType: "user",
      action: "auth.sign_out",
      resourceType: "session",
      resourceId: session.id,
    });

    sessionStore.delete(sessionId);
    return ok(undefined);
  }

  async validateSession(token: string): Promise<Result<Session>> {
    const tokenHash = hashToken(token);
    const session = sessionStore.getByTokenHash(tokenHash);

    if (!session) {
      return err(AppError.unauthorized("Invalid session token"));
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      sessionStore.delete(session.id);
      return err(AppError.unauthorized("Session expired"));
    }

    return ok(session);
  }

  async listSessions(orgId: OrgId, userId: UserId): Promise<Result<readonly Session[]>> {
    const sessions = sessionStore.listForUser(orgId, userId);
    return ok(sessions);
  }

  async revokeSession(sessionId: SessionId, actorId: UserId): Promise<Result<void>> {
    const session = sessionStore.getById(sessionId);
    if (!session) {
      return err(AppError.notFound("Session", sessionId));
    }

    const audit = getAuditEmitter();
    await audit.emit({
      orgId: session.orgId,
      actorId,
      actorType: "user",
      action: "auth.session_revoked",
      resourceType: "session",
      resourceId: session.id,
    });

    sessionStore.delete(sessionId);
    return ok(undefined);
  }

  /**
   * Sign in to a specific org context. Used after initial sign-in
   * when user needs to switch org context.
   */
  async signInToOrg(userId: UserId, orgId: OrgId, ipAddress?: string, userAgent?: string): Promise<Result<AuthResult>> {
    const user = userStore.getById(userId);
    if (!user) {
      return err(AppError.unauthorized("User not found"));
    }

    const membership = membershipStore.getForUser(orgId, userId);
    if (!membership) {
      return err(AppError.forbidden("Not a member of this organization"));
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlMs).toISOString();

    const session = sessionStore.create({
      userId,
      orgId,
      role: membership.role,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    const audit = getAuditEmitter();
    await audit.emit({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "auth.sign_in",
      resourceType: "session",
      resourceId: session.id,
    });

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      sessionToken: token,
      expiresAt: toISODateString(expiresAt),
    });
  }
}
