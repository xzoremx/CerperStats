import type { ApiResponse, Lab, RegisterPayload } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
