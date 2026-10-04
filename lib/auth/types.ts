export interface LoginRequest {
  email: string
  password: string
}

export interface AuthUser {
  idUsuario: number
  nombre: string
  apellido: string
  correo: string
  dni?: string | null
  telefono?: string | null
  fotoPerfilUrl?: string | null
  rol: string
  estado?: string
  fechaCreacion?: string | null
  idSucursal?: number | null
  nombreSucursal?: string | null
  tipoSucursal?: string | null
  sucursalesPermitidas?: unknown[]
  idTurno?: number | null
  nombreTurno?: string | null
  horaInicioTurno?: string | null
  horaFinTurno?: string | null
  diasTurno?: string[] | null
  horariosTurno?: unknown[] | null
  puedeAceptarPedidos?: boolean
  accesoCrm?: boolean
}

export interface AuthResponse {
  access_token: string
  user: AuthUser | null
}

export interface BackendLoginResponse extends AuthUser {
  access_token: string
}
