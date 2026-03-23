// ---------------------------------------------------------------------------
// User service implementation
// ---------------------------------------------------------------------------

import { ok, err, AppError } from "@sovereign/core";
import type { UserService, User, CreateUserInput, UserId, Result } from "@sovereign/core";
import { userStore } from "../store/memory-store.js";

export class InMemoryUserService implements UserService {
  async create(input: CreateUserInput): Promise<Result<User>> {
    const existing = userStore.getByEmail(input.email);
    if (existing) {
      return err(AppError.conflict(`User with email ${input.email} already exists`));
    }

    const user = userStore.create({
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
      workosUserId: input.workosUserId,
    });

    return ok(user);
  }

  async getById(id: UserId): Promise<Result<User>> {
    const user = userStore.getById(id);
    if (!user) {
      return err(AppError.notFound("User", id));
    }
    return ok(user);
  }

  async getByEmail(email: string): Promise<Result<User>> {
    const user = userStore.getByEmail(email);
    if (!user) {
      return err(AppError.notFound("User"));
    }
    return ok(user);
  }

  async update(id: UserId, input: Partial<CreateUserInput>): Promise<Result<User>> {
    const user = userStore.update(id, input);
    if (!user) {
      return err(AppError.notFound("User", id));
    }
    return ok(user);
  }
}
