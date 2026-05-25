import type { Request, Response, NextFunction } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    tenantId: string;
  }
}

/**
 * Lê tenantId do header X-Tenant-Id. Default: "default".
 * Em produção: validar contra tabela de tenants ativos.
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = (req.headers['x-tenant-id'] as string | undefined) ?? 'default';
  req.tenantId = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'default';
  next();
}
