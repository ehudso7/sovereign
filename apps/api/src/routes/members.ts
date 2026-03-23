// ---------------------------------------------------------------------------
// Membership routes — /api/v1/orgs/:orgId/members/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toOrgId, toUserId, isValidRole, ORG_ROLES } from "@sovereign/core";
import type { OrgRole } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, enforceOrgScope, requirePermission } from "../middleware/auth.js";

const updateRoleSchema = z.object({
  role: z.string().refine((r): r is OrgRole => isValidRole(r), {
    message: `Role must be one of: ${ORG_ROLES.join(", ")}`,
  }),
});

export async function memberRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/orgs/:orgId/members
  server.get<{ Params: { orgId: string } }>(
    "/api/v1/orgs/:orgId/members",
    { preHandler: [authenticate, enforceOrgScope] },
    async (request, reply) => {
      const services = getServices();
      const query = request.query as Record<string, string>;
      const result = await services.memberships.listForOrg(
        toOrgId(request.params.orgId),
        {
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
          cursor: query.cursor,
        },
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(200).send({
        data: result.value.data,
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
          total: result.value.total,
          has_more: result.value.hasMore,
          next_cursor: result.value.nextCursor,
        },
      });
    }
  );

  // PATCH /api/v1/orgs/:orgId/members/:userId — update role
  server.patch<{ Params: { orgId: string; userId: string } }>(
    "/api/v1/orgs/:orgId/members/:userId",
    { preHandler: [authenticate, enforceOrgScope, requirePermission("org:manage_roles")] },
    async (request, reply) => {
      const body = updateRoleSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      const services = getServices();
      const result = await services.memberships.changeRole(
        toOrgId(request.params.orgId),
        toUserId(request.params.userId),
        body.data.role,
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

  // DELETE /api/v1/orgs/:orgId/members/:userId — remove member
  server.delete<{ Params: { orgId: string; userId: string } }>(
    "/api/v1/orgs/:orgId/members/:userId",
    { preHandler: [authenticate, enforceOrgScope, requirePermission("org:manage_members")] },
    async (request, reply) => {
      const services = getServices();
      const result = await services.memberships.remove(
        toOrgId(request.params.orgId),
        toUserId(request.params.userId),
        request.session!.userId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(200).send({
        data: { message: "Member removed" },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );
}
