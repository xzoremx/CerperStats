export interface User {
  id: number;
  username: string;
  nombre_completo: string | null;
  email: string | null;
  rol: 'admin' | 'supervisor' | 'analista';
  default_lab: string | null;
  activo: boolean;
  creado_en: string;
}

export interface Lab {
  lab_key: string;
  nombre: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  user?: {
    id: number;
    username: string;
    nombre_completo: string | null;
  };
}

export interface RegisterPayload {
  username: string;
  password: string;
  nombre_completo: string;
  email?: string | null;
  rol: 'analista' | 'supervisor';
  default_lab?: string | null;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  nombre_completo?: string;
  email?: string;
  rol: 'admin' | 'supervisor' | 'analista';
  default_lab?: string | null;
}

export interface UpdateUserPayload {
  nombre_completo?: string;
  email?: string;
  password?: string;
  rol?: 'admin' | 'supervisor' | 'analista';
  default_lab?: string | null;
  activo?: boolean;
}
