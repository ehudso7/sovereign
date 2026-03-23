import Fastify from "fastify";
import { initServices } from "./services/index.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { orgRoutes } from "./routes/orgs.js";
import { memberRoutes } from "./routes/members.js";
import { invitationRoutes } from "./routes/invitations.js";
import { projectRoutes } from "./routes/projects.js";
import { devRoutes } from "./routes/dev.js";
import type { AuthConfig } from "@sovereign/core";

const server = Fastify({ logger: true });

// ---------------------------------------------------------------------------
// Initialize services
// ---------------------------------------------------------------------------

const authMode = (process.env.AUTH_MODE ?? "local") as "local" | "workos";
const authConfig: AuthConfig = {
  mode: authMode,
  sessionSecret: process.env.SESSION_SECRET ?? "dev-session-secret-min-32-chars-long!!",
  sessionTtlMs: parseInt(process.env.SESSION_TTL_MS ?? String(24 * 60 * 60 * 1000), 10),
  ...(authMode === "workos"
    ? {
        workos: {
          apiKey: process.env.WORKOS_API_KEY ?? "",
          clientId: process.env.WORKOS_CLIENT_ID ?? "",
        },
      }
    : {}),
};

initServices(authConfig);

// ---------------------------------------------------------------------------
// Register routes
// ---------------------------------------------------------------------------

server.register(healthRoutes);
server.register(authRoutes);
server.register(orgRoutes);
server.register(memberRoutes);
server.register(invitationRoutes);
server.register(projectRoutes);

// Dev-only routes
if (process.env.NODE_ENV !== "production") {
  server.register(devRoutes);
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const start = async () => {
  const port = parseInt(process.env.PORT || "3002", 10);
  const host = process.env.HOST || "0.0.0.0";

  try {
    await server.listen({ port, host });
    server.log.info(`API server running on ${host}:${port} (auth: ${authMode})`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

const shutdown = async () => {
  await server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { server };

start();
