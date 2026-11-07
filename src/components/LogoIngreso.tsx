/**
 * Logo de la página de ingreso: alterna entre tres versiones cada vez que se abre la página
 * (hoja verde, cuadrado de colores y rombo de colores). El navegador recuerda la última
 * mostrada para pasar a la siguiente; si no puede guardarla, elige una al azar.
 */
import React from 'react';
import { LOGO_PATH, LOGO_VIEWBOX } from './LogoHoja';

const VARIANTES = ['hoja', 'cuadrado', 'rombo'] as const;
type Variante = (typeof VARIANTES)[number];
const CLAVE = 'trakciona:logo-ingreso';

// Colores de la marca (índigo, rojo, verde y ámbar)
const COLORES = ['#312E81', '#CD0000', '#2B7F52', '#E0A21B'];
const VERDE_HOJA = '#2B7F52';

function siguienteVariante(): Variante {
  try {
    const previa = localStorage.getItem(CLAVE);
    const i = VARIANTES.indexOf(previa as Variante);
    const nueva = VARIANTES[(i + 1) % VARIANTES.length];
    localStorage.setItem(CLAVE, nueva);
    return nueva;
  } catch {
    return VARIANTES[Math.floor(Math.random() * VARIANTES.length)];
  }
}

/** Cuatro cuadrados de colores; girado 45° es el rombo. */
const Mosaico: React.FC<{ girado?: boolean }> = ({ girado }) => (
  <g transform={girado ? 'rotate(45 50 50)' : undefined}>
    <rect x="14" y="14" width="34" height="34" rx="5" fill={COLORES[0]} />
    <rect x="52" y="14" width="34" height="34" rx="5" fill={COLORES[1]} />
    <rect x="14" y="52" width="34" height="34" rx="5" fill={COLORES[2]} />
    <rect x="52" y="52" width="34" height="34" rx="5" fill={COLORES[3]} />
  </g>
);

export const LogoIngreso: React.FC<{ className?: string }> = ({ className }) => {
  // Se decide una sola vez al abrir la página
  const [variante] = React.useState<Variante>(siguienteVariante);

  if (variante === 'hoja') {
    return (
      <svg viewBox={LOGO_VIEWBOX} className={className} role="img" aria-label="Trakciona" xmlns="http://www.w3.org/2000/svg">
        <path fill={VERDE_HOJA} fillRule="evenodd" d={LOGO_PATH} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Trakciona" xmlns="http://www.w3.org/2000/svg">
      <Mosaico girado={variante === 'rombo'} />
    </svg>
  );
};
