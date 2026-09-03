import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit:action';

// Marks a handler as a privileged action. AuditInterceptor picks this up
// and writes an audit_log row after the handler succeeds — see
// docs/architecture-proposal.md §6. Values a controller can't safely log
// (e.g. raw secrets) must already be redacted in the handler's response,
// since the interceptor logs exactly what the handler returns.
export const Audited = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
