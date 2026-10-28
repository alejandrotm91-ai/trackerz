import React from 'react';

interface MacWindowProps {
  title: string;
  /** Texto secundario junto al título (p. ej. fuente o corte). */
  extra?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}

/**
 * Tarjeta con barra de título (mismo estilo que "Estado de Actividades" del Gantt)
 * que envuelve tablas. Siempre abierta. El contenido usa el tema de tabla `.ht-theme` (ver index.css).
 */
export function MacWindow({ title, extra, id, children }: MacWindowProps) {
  return (
    <section className="mac-window border border-[#D5DEE2] rounded-xl bg-white shadow-xs" id={id}>
      <div className="px-4 py-2 bg-[#F5F8F9] rounded-t-xl border-b border-[#D5DEE2]">
        <span className="block min-w-0 truncate text-[11px] font-['Barlow_Condensed'] font-semibold text-[#14212A] uppercase tracking-wider">
          {title}
          {extra && (
            <>
              {' · '}
              <span className="text-[#5A6A74] font-mono normal-case">{extra}</span>
            </>
          )}
        </span>
      </div>
      <div className="mac-body ht-theme rounded-b-xl">{children}</div>
    </section>
  );
}
