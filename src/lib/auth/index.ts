import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import * as yaml from 'js-yaml';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { UserSchema, type User, type Role } from './schemas';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'songbook-default-secret-change-me'
);
const COOKIE_NAME = 'songbook-session';

function getUsersDir(): string {
  return path.join(process.cwd(), 'content', 'users');
}

export async function listUsers(): Promise<User[]> {
  const dir = getUsersDir();
  try {
    const entries = await readdir(dir);
    const users: User[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.yaml')) continue;
      try {
        const raw = await readFile(path.join(dir, entry), 'utf-8');
        const parsed = yaml.load(raw);
        users.push(UserSchema.parse(parsed));
      } catch {}
    }
    return users;
  } catch {
    return [];
  }
}

export async function getUser(id: string): Promise<User | null> {
  const filePath = path.join(getUsersDir(), `${id}.yaml`);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = yaml.load(raw);
    return UserSchema.parse(parsed);
  } catch {
    return null;
  }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const users = await listUsers();
  return users.find((u) => u.username === username) || null;
}

export async function getUserByOidcSub(sub: string): Promise<User | null> {
  const users = await listUsers();
  return users.find((u) => u.authProvider === 'oidc' && u.oidcSub === sub) || null;
}

export async function findOrCreateOidcUser(
  sub: string,
  claims: { email?: string; name?: string; preferred_username?: string },
  role: Role
): Promise<User> {
  const existing = await getUserByOidcSub(sub);
  if (existing) {
    // Update display name / email if changed at the provider
    let changed = false;
    if (claims.name && claims.name !== existing.displayName) {
      existing.displayName = claims.name;
      changed = true;
    }
    if (claims.email && claims.email !== existing.email) {
      existing.email = claims.email;
      changed = true;
    }
    if (role !== existing.role) {
      existing.role = role;
      changed = true;
    }
    if (changed) await saveUser(existing);
    return existing;
  }

  const username = claims.preferred_username || claims.email || sub;
  const id = `oidc-${sub.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 60)}`;
  const user: User = {
    id,
    username,
    role,
    authProvider: 'oidc',
    oidcSub: sub,
    displayName: claims.name,
    email: claims.email,
    created: new Date().toISOString(),
  };
  await saveUser(user);
  return user;
}

export async function saveUser(user: User): Promise<void> {
  const dir = getUsersDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${user.id}.yaml`);
  const content = yaml.dump(user, { lineWidth: -1 });
  await writeFile(filePath, content, 'utf-8');
}

export async function createUser(
  username: string,
  password: string,
  role: Role,
  displayName?: string
): Promise<User> {
  const id = username.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    id,
    username,
    passwordHash,
    role,
    authProvider: 'local',
    displayName,
    created: new Date().toISOString(),
  };
  await saveUser(user);
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  const { rm } = await import('fs/promises');
  const filePath = path.join(getUsersDir(), `${id}.yaml`);
  await rm(filePath);
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  if (!user.passwordHash) return false; // OIDC-only users cannot use password login
  return bcrypt.compare(password, user.passwordHash);
}

export async function createSession(user: User): Promise<string> {
  const token = await new SignJWT({ userId: user.id, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  return token;
}

export async function getSession(): Promise<{ userId: string; role: Role } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: payload.userId as string, role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  return getUser(session.userId);
}

export function canRead(_role: Role | null): boolean {
  return true; // everyone can read
}

export function canEdit(role: Role | null): boolean {
  return role === 'reviewer' || role === 'admin';
}

export function canAdmin(role: Role | null): boolean {
  return role === 'admin';
}

export async function ensureDefaultAdmin(): Promise<void> {
  const users = await listUsers();
  if (users.length === 0) {
    // Create default admin user
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    await createUser('admin', adminPassword, 'admin', 'Administrator');
  }
}
