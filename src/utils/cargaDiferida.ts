/**
 * Carga diferida de módulos (React.lazy) resistente a los despliegues.
 *
 * Cada `npm run deploy` cambia el nombre de los archivos JS. Si alguien tenía la app abierta
 * desde antes y abre una pestaña que se carga aparte (por ejemplo, Gestiona), el navegador pide
 * el archivo viejo, que ya no existe: el servidor responde con la página HTML y la carga falla.
 * En ese caso se recarga la página una vez para traer la versión nueva.
 */
import React from 'react';

const CLAVE = 'trakciona.recargaPorVersion';

function recargarUnaVez(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE) || 0);
    if (Date.now() - ultima < 30_000) return false; // ya se recargó hace poco: no entrar en bucle
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch { /* sin almacenamiento: recargar igual */ }
  window.location.reload();
  return true;
}

export function lazyConRecarga<T extends React.ComponentType<any>>(importar: () => Promise<{ default: T }>) {
  return React.lazy(async () => {
    try {
      return await importar();
    } catch (e) {
      if (recargarUnaVez()) return new Promise<{ default: T }>(() => { /* la página se está recargando */ });
      throw e;
    }
  });
}

// Vite avisa con este evento cuando falla la precarga de un módulo (misma causa).
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', ev => {
    if (recargarUnaVez()) ev.preventDefault();
  });
}

/** Muestra el error de una sección (en vez de dejar la app en blanco) con un botón para recargar. */
export class LimiteDeError extends React.Component<{ nombre: string; children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(`Error en ${this.props.nombre}:`, error); }
  render() {
    if (!this.state.error) return this.props.children;
    return React.createElement('div', { className: 'py-12 px-6 text-center text-sm text-[#5A6A74] space-y-3' },
      React.createElement('p', { className: 'font-semibold text-[#14212A]' }, `No se pudo abrir ${this.props.nombre}.`),
      React.createElement('p', { className: 'text-xs font-mono break-all' }, this.state.error.message),
      React.createElement('button', {
        className: 'px-3 py-1.5 rounded-lg bg-[#312E81] text-white font-bold cursor-pointer',
        onClick: () => window.location.reload(),
      }, 'Recargar la página'));
  }
}
