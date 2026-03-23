// ---------------------------------------------------------------------------
// Project service implementation
// ---------------------------------------------------------------------------

import { ok, err, AppError, paginatedResult } from "@sovereign/core";
import type {
  ProjectService,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  OrgId,
  UserId,
  ProjectId,
  Result,
  PaginatedResult,
  PaginationParams,
} from "@sovereign/core";
import { projectStore } from "../store/memory-store.js";
import { getAuditEmitter } from "./audit.service.js";

export class InMemoryProjectService implements ProjectService {
  async create(input: CreateProjectInput, creatorId: UserId): Promise<Result<Project>> {
    // Check slug uniqueness within org
    const existing = projectStore.listForOrg(input.orgId).find(
      (p) => p.slug === input.slug
    );
    if (existing) {
      return err(AppError.conflict(`Project with slug '${input.slug}' already exists in this organization`));
    }

    const project = projectStore.create({
      orgId: input.orgId,
      name: input.name,
      slug: input.slug,
      description: input.description,
    });

    const audit = getAuditEmitter();
    await audit.emit({
      orgId: input.orgId,
      actorId: creatorId,
      actorType: "user",
      action: "project.created",
      resourceType: "project",
      resourceId: project.id,
      metadata: { name: project.name, slug: project.slug },
    });

    return ok(project);
  }

  async getById(projectId: ProjectId, orgId: OrgId): Promise<Result<Project>> {
    const project = projectStore.getById(projectId);
    if (!project || project.orgId !== orgId) {
      return err(AppError.notFound("Project", projectId));
    }
    return ok(project);
  }

  async update(projectId: ProjectId, orgId: OrgId, input: UpdateProjectInput): Promise<Result<Project>> {
    const project = projectStore.getById(projectId);
    if (!project || project.orgId !== orgId) {
      return err(AppError.notFound("Project", projectId));
    }

    // If changing slug, check uniqueness
    if (input.slug && input.slug !== project.slug) {
      const existing = projectStore.listForOrg(orgId).find(
        (p) => p.slug === input.slug && p.id !== projectId
      );
      if (existing) {
        return err(AppError.conflict(`Project with slug '${input.slug}' already exists`));
      }
    }

    const updated = projectStore.update(projectId, input);
    if (!updated) {
      return err(AppError.internal());
    }

    const audit = getAuditEmitter();
    await audit.emit({
      orgId,
      actorId: undefined, // Will be set by the route handler via tenant context
      actorType: "user",
      action: "project.updated",
      resourceType: "project",
      resourceId: projectId,
      metadata: { changes: input },
    });

    return ok(updated);
  }

  async listForOrg(orgId: OrgId, pagination?: PaginationParams): Promise<Result<PaginatedResult<Project>>> {
    const projects = projectStore.listForOrg(orgId);
    const limit = Math.min(pagination?.limit ?? 20, 100);
    const startIdx = pagination?.cursor ? parseInt(pagination.cursor, 10) : 0;
    const slice = projects.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < projects.length ? String(startIdx + limit) : undefined;

    return ok(paginatedResult(slice, projects.length, nextCursor));
  }

  async delete(projectId: ProjectId, orgId: OrgId): Promise<Result<void>> {
    const project = projectStore.getById(projectId);
    if (!project || project.orgId !== orgId) {
      return err(AppError.notFound("Project", projectId));
    }

    projectStore.delete(projectId);

    const audit = getAuditEmitter();
    await audit.emit({
      orgId,
      actorType: "user",
      action: "project.deleted",
      resourceType: "project",
      resourceId: projectId,
      metadata: { name: project.name },
    });

    return ok(undefined);
  }
}
