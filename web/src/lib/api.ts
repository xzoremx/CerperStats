import type {
  ApiResponse,
  Lab,
  User,
  RegisterPayload,
  CreateUserPayload,
  UpdateUserPayload
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Public API calls
export async function fetchLabs(): Promise<ApiResponse<Lab[]>> {
  const res = await fetch(`${API_URL}/register/labs`);
  return res.json();
}

export async function registerUser(payload: RegisterPayload): Promise<ApiResponse<null>> {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// Admin API calls
export async function adminApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const auth = typeof window !== 'undefined' ? localStorage.getItem('adminAuth') : null;

  const res = await fetch(`${API_URL}/admin${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { 'X-Admin-Auth': auth } : {}),
      ...options.headers,
    },
  });

  return res.json();
}

export async function fetchUsers(): Promise<ApiResponse<User[]>> {
  return adminApi<User[]>('/users');
}

export async function fetchAdminLabs(): Promise<ApiResponse<Lab[]>> {
  return adminApi<Lab[]>('/labs');
}

export async function createUser(payload: CreateUserPayload): Promise<ApiResponse<User>> {
  return adminApi<User>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<ApiResponse<User>> {
  return adminApi<User>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id: number): Promise<ApiResponse<null>> {
  return adminApi<null>(`/users/${id}`, {
    method: 'DELETE',
  });
}

export function setAdminAuth(username: string, password: string): void {
  const auth = btoa(`${username}:${password}`);
  localStorage.setItem('adminAuth', auth);
}

export function clearAdminAuth(): void {
  localStorage.removeItem('adminAuth');
}

export function getAdminAuth(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('adminAuth') : null;
}
