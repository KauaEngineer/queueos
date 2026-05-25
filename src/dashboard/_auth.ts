import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware de HTTP Basic Auth.
 * Espera header: Authorization: Basic base64(user:pass)
 * Usuário "admin", senha = process.env.DASHBOARD_SECRET.
 */
export function basicAuth(secret: string) {
  const expected = 'Basic ' + Buffer.from(`admin:${secret}`).toString('base64');

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization === expected) {
      return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="QueueOS"');
    res.status(401).send('Autenticação necessária');
  };
}
