// ---------------------------------------------------------------------------
// Auth routes — POST /api/v1/auth/*
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toOrgId } from "@sovereign/core";
import { getServices } from "../services/index.js";
import { authenticate } from "../middleware/auth.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  orgId: z.string().uuid().optional(),
});

const switchOrgSchema = z.object({
  orgId: z.string().uuid(),
});

export async function authRoutes(server: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/login
  server.post("/api/v1/auth/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const services = getServices();
    const result = await services.auth.signIn(body.data.email, body.data.password);

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
  });

  // POST /api/v1/auth/switch-org
  server.post("/api/v1/auth/switch-org", { preHandler: [authenticate] }, async (request, reply) => {
    const body = switchOrgSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const services = getServices();
    const result = await services.auth.signInToOrg(
      request.session!.userId,
      toOrgId(body.data.orgId),
      request.ip,
      request.headers["user-agent"],
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
  });

  // POST /api/v1/auth/logout
  server.post("/api/v1/auth/logout", { preHandler: [authenticate] }, async (request, reply) => {
    const services = getServices();
    const result = await services.auth.signOut(request.session!.id);

    if (!result.ok) {
      return reply.status(result.error.statusCode).send({
        error: { code: result.error.code, message: result.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    return reply.status(200).send({
      data: { message: "Logged out successfully" },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // GET /api/v1/auth/me
  server.get("/api/v1/auth/me", { preHandler: [authenticate] }, async (request, reply) => {
    const services = getServices();
    const userResult = await services.users.getById(request.session!.userId);
    if (!userResult.ok) {
      return reply.status(userResult.error.statusCode).send({
        error: { code: userResult.error.code, message: userResult.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const orgResult = await services.orgs.getById(request.session!.orgId, request.session!.userId);

    return reply.status(200).send({
      data: {
        user: userResult.value,
        org: orgResult.ok ? orgResult.value : null,
        role: request.session!.role,
        sessionId: request.session!.id,
      },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });

  // GET /api/v1/auth/sessions
  server.get("/api/v1/auth/sessions", { preHandler: [authenticate] }, async (request, reply) => {
    const services = getServices();
    const result = await services.auth.listSessions(request.session!.orgId, request.session!.userId);

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
  });

  // DELETE /api/v1/auth/sessions/:sessionId
  server.delete<{ Params: { sessionId: string } }>(
    "/api/v1/auth/sessions/:sessionId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const services = getServices();
      const { toSessionId } = await import("@sovereign/core");
      const result = await services.auth.revokeSession(
        toSessionId(request.params.sessionId),
        request.session!.userId,
      );

      if (!result.ok) {
        return reply.status(result.error.statusCode).send({
          error: { code: result.error.code, message: result.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }

      return reply.status(200).send({
        data: { message: "Session revoked" },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }
  );
}
