// ---------------------------------------------------------------------------
// Service registry — centralized access to all Phase 2 services
// ---------------------------------------------------------------------------

import type {
  AuthService,
  UserService,
  OrgService,
  MembershipService,
  InvitationService,
  ProjectService,
  AuditEmitter,
  AuthConfig,
} from "@sovereign/core";
import { LocalAuthService } from "./auth.service.js";
import { InMemoryUserService } from "./user.service.js";
import { InMemoryOrgService } from "./org.service.js";
import { InMemoryMembershipService } from "./membership.service.js";
import { InMemoryInvitationService } from "./invitation.service.js";
import { InMemoryProjectService } from "./project.service.js";
import { initAuditEmitter, getAuditEmitter } from "./audit.service.js";

export interface ServiceRegistry {
  auth: AuthService & { signInToOrg: LocalAuthService["signInToOrg"] };
  users: UserService;
  orgs: OrgService;
  memberships: MembershipService;
  invitations: InvitationService;
  projects: ProjectService;
  audit: AuditEmitter;
}

let _registry: ServiceRegistry | null = null;

export function initServices(authConfig: AuthConfig): ServiceRegistry {
  initAuditEmitter();

  _registry = {
    auth: new LocalAuthService(authConfig),
    users: new InMemoryUserService(),
    orgs: new InMemoryOrgService(),
    memberships: new InMemoryMembershipService(),
    invitations: new InMemoryInvitationService(),
    projects: new InMemoryProjectService(),
    audit: getAuditEmitter(),
  };

  return _registry;
}

export function getServices(): ServiceRegistry {
  if (!_registry) {
    throw new Error("Services not initialized. Call initServices() first.");
  }
  return _registry;
}

export { getAuditEmitter } from "./audit.service.js";
