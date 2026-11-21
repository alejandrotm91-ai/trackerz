// Llamadas a la API del Worker. La sesión viaja en una cookie, así que no hace falta
// mandar ningún token a mano.

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * fetch con manejo de errores: lanza ApiError si la respuesta no es exitosa,
 * salvo para los códigos indicados en `allowStatus`.
 */
export async function apiFetch(path: string, init?: RequestInit, allowStatus: number[] = []): Promise<Response> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  if (!res.ok && !allowStatus.includes(res.status)) {
    const data = await res.json().catch(() => ({} as any));
    const message = data.error || data.message || `Error ${res.status} al llamar a ${path}`;
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('trackerz:session-expired'));
    }
    throw new ApiError(message, res.status);
  }
  return res;
}
