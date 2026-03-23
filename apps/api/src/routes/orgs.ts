// ---------------------------------------------------------------------------
// Organization routes — /api/v1/orgs/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toOrgId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate, enforceOrgScope, requirePermission } from "../middleware/auth.js";

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: z.record(z.unknown()).optional(),
});

export async function orgRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/v1/orgs — list orgs for current user
  server.get("/api/v1/orgs", { preHandler: [authenticate] }, async (request, reply) => {
    const services = getServices();
    const query = request.query as Record<string, string>;
    const result = await services.orgs.listForUser(request.session!.userId, {
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      cursor: query.cursor,
    });

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
  });

  // POST /api/v1/orgs — create organization
  server.post("/api/v1/orgs", { preHandler: [authenticate] }, async (request, reply) => {
    const body = createOrgSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const services = getServices();
    const result = await services.orgs.create(body.data, request.session!.userId);

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
  });

  // GET /api/v1/orgs/:orgId
  server.get<{ Params: { orgId: string } }>(
    "/api/v1/orgs/:orgId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const services = getServices();
      const result = await services.orgs.getById(
        toOrgId(request.params.orgId),
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

  // PATCH /api/v1/orgs/:orgId
  server.patch<{ Params: { orgId: string } }>(
    "/api/v1/orgs/:orgId",
    { preHandler: [authenticate, enforceOrgScope, requirePermission("org:update")] },
    async (request, reply) => {
      const body = updateOrgSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      const services = getServices();
      const result = await services.orgs.update(
        toOrgId(request.params.orgId),
        request.session!.userId,
        body.data,
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
}
