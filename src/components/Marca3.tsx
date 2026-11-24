/**
 * Marca de los botones T₃ y M₃ de la barra principal: la letra en rojo y el 3 en subíndice en estilo
 * cyberpunk (fuente Orbitron, rojo neón con brillo y desdoble cian/magenta).
 */
import React from 'react';

export const Marca3: React.FC<{ letra: string }> = ({ letra }) => (
  <span className="leading-none text-[#CD0000] font-extrabold text-[15px] tracking-tight">
    {letra}
    <sub
      className="leading-none text-[0.72em] ml-[1px]"
      style={{
        fontFamily: "'Orbitron', 'IBM Plex Mono', monospace",
        fontWeight: 900,
        color: '#FF1F3D',
        textShadow: '-1px 0 rgba(0, 240, 255, 0.85), 1px 0 rgba(255, 0, 170, 0.75), 0 0 4px rgba(255, 31, 61, 0.9), 0 0 9px rgba(255, 31, 61, 0.55)',
      }}
    >3</sub>
  </span>
);
