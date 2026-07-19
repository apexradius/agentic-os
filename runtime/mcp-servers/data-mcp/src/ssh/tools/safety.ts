import type { ServerConfig } from '../pool.js';

export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function resolveServer(
  servers: Map<string, ServerConfig>,
  serverId?: string,
): { config?: ServerConfig; label: string; error?: string } {
  if (!serverId) return { label: 'default' };
  const config = servers.get(serverId);
  if (!config) return { label: serverId, error: `Unknown server: ${serverId}` };
  return { config, label: serverId };
}

function pathPortion(value: string): string {
  if (value.startsWith('remote:')) return value.slice('remote:'.length);
  const remoteMatch = value.match(/^[^@\s:]+@[^:\s]+:(.*)$/);
  return remoteMatch?.[1] ?? value;
}

export function rejectTraversalPath(value: string, label: string): string | null {
  if (value.includes('\0')) return `${label} contains a null byte`;
  const path = pathPortion(value);
  const parts = path.split(/[\\/]+/);
  if (parts.includes('..')) return `${label} must not contain '..' path segments`;
  return null;
}

export function validateGitBranch(branch: string): string | null {
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) {
    return 'branch contains unsupported characters';
  }
  if (
    branch.startsWith('-') ||
    branch.startsWith('/') ||
    branch.endsWith('/') ||
    branch.endsWith('.') ||
    branch.includes('..') ||
    branch.includes('//') ||
    branch.includes('@{') ||
    branch === '@' ||
    branch.split('/').some((part) => part.startsWith('.') || part.endsWith('.lock'))
  ) {
    return 'branch is not a safe git ref name';
  }
  return null;
}

export function rejectUnsafeSql(query: string): string | null {
  const trimmed = query.trim().replace(/^\/\*[\s\S]*?\*\/\s*/g, '');
  const firstWord = trimmed.split(/\s+/)[0]?.toUpperCase();
  if (!['SELECT', 'SHOW', 'EXPLAIN', 'WITH', 'DESCRIBE'].includes(firstWord ?? '')) {
    return 'Only SELECT/SHOW/EXPLAIN/WITH/DESCRIBE queries allowed via SSH';
  }
  if (trimmed.includes(';')) {
    return 'Multi-statement SQL is not allowed via SSH';
  }
  if (
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|CALL|EXECUTE|MERGE|UNION)\b/i.test(
      trimmed,
    )
  ) {
    return 'Potentially mutating SQL keywords are not allowed via SSH';
  }
  return null;
}
