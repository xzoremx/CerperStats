export interface Lab {
  lab_key: string;
  nombre: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface RegisterPayload {
  password: string;
  nombre_completo: string;
  sede: 'Paita' | 'Chimbote' | 'Arequipa' | 'Callao';
  default_lab?: string | string[];
}
