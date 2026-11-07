import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from '../core/http.js';
import type { Logger } from '../core/logger.js';

/* ================================================================== *
 *  VortexStorageGuard — Row-Level Access Security (RLS)               *
 *                                                                    *
 *  Validates the caller's JWT claims against the object path being    *
 *  touched. Example shipped rule:                                     *
 *                                                                    *
 *    buckets/user-avatars/{user_id}/*  ⟹  jwt.sub === {user_id}       *
 *                                                                    *
 *  Rules are regex patterns whose first capture group is the owner    *
 *  id; the named claim inside the verified JWT must equal it.         *
 * ================================================================== */

export interface VortexJwtClaims {
  sub?: string;
  role?: string;
  [claim: string]: unknown;
}

export interface RlsRule {
  name: string;
  /** Regex matched against the object key; group 1 must equal the claim. */
  pattern: string;
  /** JWT claim compared against capture group 1 (e.g. "sub"). */
  claim: string;
  actions?: Array<'read' | 'write'>;
}

export const DEFAULT_RLS_RULES: RlsRule[] = [
  {
    name: 'user-avatars-owner',
    pattern: '^buckets/user-avatars/([^/]+)(?:/|$)',
    claim: 'sub',
    actions: ['read', 'write'],
  },
  {
    name: 'tenant-private-docs',
    pattern: '^buckets/tenant-docs/([^/]+)(?:/|$)',
    claim: 'tenant_id',
    actions: ['read', 'write'],
  },
];

export function parseRlsRules(rawJson: string | undefined, logger: Logger): RlsRule[] {
  if (!rawJson) return DEFAULT_RLS_RULES;
  try {
    const parsed = JSON.parse(rawJson) as RlsRule[];
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed;
  } catch (error) {
    logger.error('VORTEX_RLS_RULES is invalid JSON — using default rules', error);
    return DEFAULT_RLS_RULES;
  }
}

interface GuardOptions {
  disabled: boolean;
  jwtSecret: string;
  jwtIssuer: string;
  adminKey: string;
  rules: RlsRule[];
  logger: Logger;
}

/** Extract the object key a request targets, regardless of transport style. */
function extractTargetKey(req: Request): string | undefined {
  const fromQuery = req.query['key'] ?? req.query['path'];
  if (typeof fromQuery === 'string' && fromQuery.length > 0) return fromQuery;
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body['key'] === 'string') return body['key'];
  return undefined;
}

function actionOf(req: Request): 'read' | 'write' {
  return req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write';
}

function evaluateRules(
  rules: RlsRule[],
  key: string | undefined,
  action: 'read' | 'write',
  claims: VortexJwtClaims,
): { allowed: boolean; violated?: string } {
  // Service/admin identities (like Supabase's service_role) bypass RLS.
  if (claims.role === 'admin') return { allowed: true };
  if (!key) return { allowed: true };
  for (const rule of rules) {
    if (rule.actions && !rule.actions.includes(action)) continue;
    const match = new RegExp(rule.pattern).exec(key);
    if (!match) continue;
    const ownerId = match[1];
    const claimValue = claims[rule.claim];
    if (typeof claimValue !== 'string' || claimValue !== ownerId) {
      return { allowed: false, violated: rule.name };
    }
  }
  return { allowed: true };
}

/**
 * The guard middleware factory. When `VORTEX_AUTH_DISABLED=true` (local
 * development default) every request receives a synthetic dev identity
 * and an `x-vortex-auth: bypassed` header — never enable this in prod.
 */
export function vortexStorageGuard(options: GuardOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    let claims: VortexJwtClaims;

    // A valid admin key authenticates as the admin service identity,
    // satisfying both authentication and RLS (documented control-plane path).
    const providedKey = String(req.headers['x-vortex-admin-key'] ?? '');
    const isAdmin =
      providedKey.length > 0 &&
      providedKey.length === options.adminKey.length &&
      timingSafeEqual(Buffer.from(providedKey), Buffer.from(options.adminKey));

    if (isAdmin) {
      claims = { sub: 'vortex-admin', role: 'admin' };
      res.setHeader('x-vortex-auth', 'admin-key');
    } else if (options.disabled) {
      claims = { sub: 'dev-user', role: 'admin', tenant_id: 'dev-tenant' };
      res.setHeader('x-vortex-auth', 'bypassed');
    } else {
      const header = req.headers.authorization ?? '';
      const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
      if (!token) {
        next(HttpError.unauthorized('Missing Bearer token'));
        return;
      }
      try {
        claims = jwt.verify(token, options.jwtSecret, {
          algorithms: ['HS256'],
          issuer: options.jwtIssuer,
        }) as VortexJwtClaims;
      } catch {
        next(HttpError.unauthorized('Invalid or expired JWT'));
        return;
      }
    }

    const key = extractTargetKey(req);
    const verdict = evaluateRules(options.rules, key, actionOf(req), claims);
    if (!verdict.allowed) {
      options.logger.warn('RLS denied request', {
        rule: verdict.violated,
        key,
        sub: claims.sub,
        method: req.method,
      });
      next(
        HttpError.forbidden(
          `Row-level access policy "${verdict.violated}" denies ${actionOf(req)} on this key`,
        ),
      );
      return;
    }

    (req as Request & { vortexClaims?: VortexJwtClaims }).vortexClaims = claims;
    next();
  };
}

/** Separate admin gate for control-plane mutations (e.g. provider switch). */
export function adminGuard(adminKey: string): RequestHandler {
  const expected = Buffer.from(adminKey);
  return (req: Request, _res: Response, next: NextFunction): void => {
    const provided = Buffer.from(String(req.headers['x-vortex-admin-key'] ?? ''));
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      next();
      return;
    }
    next(HttpError.unauthorized('Valid X-Vortex-Admin-Key header required'));
  };
}
