// ---------------------------------------------------------------------------
// Audit service — emits audit events for auth-sensitive actions
// ---------------------------------------------------------------------------

import type { AuditEmitter, EmitAuditEventInput, AuditEvent, AuditQueryParams, OrgId } from "@sovereign/core";
import { auditStore } from "../store/memory-store.js";

export class InMemoryAuditEmitter implements AuditEmitter {
  async emit(input: EmitAuditEventInput): Promise<void> {
    auditStore.emit(input);
  }

  async query(orgId: OrgId, params?: AuditQueryParams): Promise<readonly AuditEvent[]> {
    return auditStore.query(orgId, params);
  }
}

let _emitter: AuditEmitter | null = null;

export function initAuditEmitter(emitter?: AuditEmitter): AuditEmitter {
  _emitter = emitter ?? new InMemoryAuditEmitter();
  return _emitter;
}

export function getAuditEmitter(): AuditEmitter {
  if (!_emitter) {
    _emitter = new InMemoryAuditEmitter();
  }
  return _emitter;
}
