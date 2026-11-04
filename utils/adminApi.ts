import { projectId } from './supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

// ─── Stockage du token admin ────────────────────────────────────────────────

const TOKEN_KEY = 'ayo_admin_token';
const EXPIRES_KEY = 'ayo_admin_expires';

export function getAdminToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expires = Number(sessionStorage.getItem(EXPIRES_KEY) || 0);
  if (!token) return null;
  if (expires && Date.now() > expires) {
    clearAdminToken();
    return null;
  }
  return token;
}

export function setAdminToken(token: string, expiresAt: number) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}

// ─── Appels API ────────────────────────────────────────────────────────────

export interface AdminAuthResponse {
  success: boolean;
  token: string;
  expiresAt: number;
}

export async function adminLogin(id: string, password: string): Promise<AdminAuthResponse> {
  const res = await fetch(`${API_BASE}/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function adminVerify(token: string): Promise<{ valid: boolean; payload?: any }> {
  const res = await fetch(`${API_BASE}/admin/verify`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  return data;
}

export async function adminRotatePassword(): Promise<{
  success: boolean;
  id: string;
  password: string;
  warning: string;
  rotatedAt: string;
  nextRotation: string;
}> {
  const token = getAdminToken();
  if (!token) throw new Error('Admin not authenticated');

  const res = await fetch(`${API_BASE}/admin/rotate-password`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Rotation failed');
  return data;
}