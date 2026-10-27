import React from 'react';

interface MacWindowProps {
  title: string;
  /** Texto corto a la derecha de la barra de título (p. ej. fuente o corte). */
  extra?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}

/**
 * Ventana estilo macOS (barra con los tres botones) que envuelve tablas.
 * El contenido usa el tema de tabla jerárquica `.ht-theme` (ver index.css).
 */
export function MacWindow({ title, extra, id, children }: MacWindowProps) {
  return (
    <section className="mac-window" id={id}>
      <div className="mac-titlebar">
        <span className="mac-dots" aria-hidden="true">
          <i /><i /><i />
        </span>
        <span className="mac-title">{title}</span>
        {extra && <span className="mac-extra">{extra}</span>}
      </div>
      <div className="mac-body ht-theme">{children}</div>
    </section>
  );
}
