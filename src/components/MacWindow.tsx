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
 * que envuelve tablas. El contenido usa el tema de tabla `.ht-theme` (ver index.css).
 */
export function MacWindow({ title, extra, id, children }: MacWindowProps) {
  const [open, setOpen] = React.useState(true);
  return (
    <section className="mac-window border border-[#D5DEE2] rounded-xl overflow-hidden bg-white shadow-xs" id={id}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2 bg-[#F5F8F9] hover:bg-[#EEF2F3] cursor-pointer text-left ${open ? 'border-b border-[#D5DEE2]' : ''}`}
      >
        <span className="min-w-0 truncate text-[11px] font-['Barlow_Condensed'] font-semibold text-[#14212A] uppercase tracking-wider">
          {title}
          {extra && (
            <>
              {' · '}
              <span className="text-[#5A6A74] font-mono normal-case">{extra}</span>
            </>
          )}
        </span>
        <span className="text-[#5A6A74] text-xs shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="mac-body ht-theme">{children}</div>}
    </section>
  );
}
