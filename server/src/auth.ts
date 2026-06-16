import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { prisma } from './db';

// Read lazily so dotenv has loaded by the time these run.
function secret(): string {
  return process.env.JWT_SECRET || 'dev-secret-change-me';
}

const TOKEN_TTL = '30d';

export interface TokenPayload {
  userId: string;
  username: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret());
    if (typeof decoded === 'object' && decoded && 'userId' in decoded && 'username' in decoded) {
      const d = decoded as Record<string, unknown>;
      return { userId: String(d.userId), username: String(d.username) };
    }
    return null;
  } catch {
    return null;
  }
}

type DbUser = { id: string; username: string; email: string; totalGames: number; wins: number };

function publicUser(u: DbUser) {
  return { id: u.id, username: u.username, email: u.email, totalGames: u.totalGames, wins: u.wins };
}

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const username = String(req.body?.username ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (!USERNAME_RE.test(username)) {
    res.status(400).json({ error: 'Kullanıcı adı 3-20 karakter olmalı (harf, rakam, _).' });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Geçerli bir e-posta gir.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { username, email, passwordHash } });
    const token = signToken({ userId: user.id, username: user.username });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2002') {
      const target = (e as { meta?: { target?: unknown } })?.meta?.target;
      const field = Array.isArray(target) ? String(target[0]) : String(target);
      res.status(409).json({
        error: field.includes('email') ? 'Bu e-posta zaten kayıtlı.' : 'Bu kullanıcı adı zaten alınmış.',
      });
      return;
    }
    console.error('[auth] register error', e);
    // TEMP DEBUG: expose the real cause to diagnose the deploy; revert after.
    res.status(500).json({
      error: 'Kayıt sırasında bir hata oluştu.',
      debug: (e as Error)?.message,
      code: (e as { code?: string })?.code,
    });
  }
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const identifier = String(req.body?.identifier ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (!identifier || !password) {
    res.status(400).json({ error: 'Kullanıcı adı/e-posta ve şifre gerekli.' });
    return;
  }

  try {
    const isEmail = identifier.includes('@');
    const user = await prisma.user.findUnique({
      where: isEmail ? { email: identifier.toLowerCase() } : { username: identifier },
    });
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !ok) {
      res.status(401).json({ error: 'Kullanıcı adı/e-posta veya şifre hatalı.' });
      return;
    }
    const token = signToken({ userId: user.id, username: user.username });
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    console.error('[auth] login error', e);
    res.status(500).json({ error: 'Giriş sırasında bir hata oluştu.' });
  }
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Geçersiz oturum.' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    return;
  }
  res.json({ user: publicUser(user) });
}
