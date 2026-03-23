// ---------------------------------------------------------------------------
// Invitation routes — /api/v1/orgs/:orgId/invitations/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toOrgId, isValidRole, ORG_ROLES } from "@sovereign/core";
import type { OrgRole } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, enforceOrgScope, requirePermission } from "../middleware/auth.js";

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.string().refine((r): r is OrgRole => isValidRole(r), {
    message: `Role must be one of: ${ORG_ROLES.join(", ")}`,
  }).default("org_member"),
});

export async function invitationRoutes(server: FastifyInstance): Promise<void> {
  // POST /api/v1/orgs/:orgId/invitations
  server.post<{ Params: { orgId: string } }>(
    "/api/v1/orgs/:orgId/invitations",
    { preHandler: [authenticate, enforceOrgScope, requirePermission("org:manage_members")] },
    async (request, reply) => {
      const body = createInvitationSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      const services = getServices();
      const result = await services.invitations.create({
        orgId: toOrgId(request.params.orgId),
        email: body.data.email,
        role: body.data.role,
        invitedBy: request.session!.userId,
      });

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(201).send({
        data: result.value,
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );

  // GET /api/v1/orgs/:orgId/invitations
  server.get<{ Params: { orgId: string } }>(
    "/api/v1/orgs/:orgId/invitations",
    { preHandler: [authenticate, enforceOrgScope, requirePermission("org:manage_members")] },
    async (request, reply) => {
      const services = getServices();
      const result = await services.invitations.listForOrg(toOrgId(request.params.orgId));

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(200).send({
        data: result.value,
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );

  // POST /api/v1/invitations/:invitationId/accept
  server.post<{ Params: { invitationId: string } }>(
    "/api/v1/invitations/:invitationId/accept",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const services = getServices();
      const result = await services.invitations.accept(
        request.params.invitationId,
        request.session!.userId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(200).send({
        data: result.value,
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );

  // DELETE /api/v1/orgs/:orgId/invitations/:invitationId
  server.delete<{ Params: { orgId: string; invitationId: string } }>(
    "/api/v1/orgs/:orgId/invitations/:invitationId",
    { preHandler: [authenticate, enforceOrgScope, requirePermission("org:manage_members")] },
    async (request, reply) => {
      const services = getServices();
      const result = await services.invitations.revoke(
        request.params.invitationId,
        toOrgId(request.params.orgId),
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(200).send({
        data: { message: "Invitation revoked" },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );
}
