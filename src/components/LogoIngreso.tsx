/**
 * Logo de la página de ingreso: la hoja de Trakciona alterna entre rojo y negro cada
 * 5 segundos, con un fundido suave (no recarga la página).
 */
import React from 'react';
import { LOGO_PATH, LOGO_VIEWBOX, LOGO_ROJO } from './LogoHoja';

const COLORES = [LOGO_ROJO, '#14212A']; // rojo de la marca y negro de la app
const INTERVALO_MS = 5000;

export const LogoIngreso: React.FC<{ className?: string }> = ({ className }) => {
  const [i, setI] = React.useState(0);

  React.useEffect(() => {
    const t = window.setInterval(() => setI(v => (v + 1) % COLORES.length), INTERVALO_MS);
    return () => window.clearInterval(t);
  }, []);

  return (
    <svg viewBox={LOGO_VIEWBOX} className={className} role="img" aria-label="Trakciona" xmlns="http://www.w3.org/2000/svg">
      <path fill={COLORES[i]} fillRule="evenodd" d={LOGO_PATH} style={{ transition: 'fill 1s ease-in-out' }} />
    </svg>
  );
};
