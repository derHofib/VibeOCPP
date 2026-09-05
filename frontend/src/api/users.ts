import { apiFetch } from '../lib/api-client.js';
import type { Role } from '../lib/roles.js';

export interface UserRow {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: Role;
}

export function listUsers(): Promise<UserRow[]> {
  return apiFetch<UserRow[]>('/users');
}

export function createUser(input: CreateUserInput): Promise<UserRow> {
  return apiFetch<UserRow>('/users', { method: 'POST', body: input });
}

export function setUserActive(id: string, isActive: boolean): Promise<UserRow> {
  return apiFetch<UserRow>(`/users/${id}/active`, { method: 'PATCH', body: { isActive } });
}
