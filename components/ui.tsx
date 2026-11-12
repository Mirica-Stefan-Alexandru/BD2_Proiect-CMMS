// Componente de prezentare reutilizabile (fara stare, sigure in Server Components).
import type { CSSProperties, ReactNode } from 'react';
import { getRoleBadge, getStatusConfig, getTestConfig, initiale } from '@/lib/ui';
import { LABEL_STATUS, LABEL_TEST } from '@/lib/roluri';

export const inputCls =
    'w-full bg-[#222831] border border-[#EEEEEE]/15 hover:border-[#EEEEEE]/30 focus:border-[#FFD369] rounded-xl px-3.5 py-2 text-xs text-[#EEEEEE] placeholder-[#EEEEEE]/40 focus:outline-none transition-colors disabled:opacity-50';
export const labelCls = 'block text-[10px] font-mono uppercase tracking-wider text-[#EEEEEE]/60 mb-1.5 ml-0.5';
export const btnPrimar =
    'inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#FFD369] hover:bg-[#ffdc85] active:scale-[0.98] text-[#222831] rounded-xl text-xs font-bold transition-all shadow-sm shadow-black/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';
export const btnSecundar =
    'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#222831] hover:bg-[#2b313a] text-[#EEEEEE]/80 hover:text-[#EEEEEE] rounded-xl text-xs font-semibold border border-[#EEEEEE]/15 hover:border-[#EEEEEE]/30 transition-all disabled:opacity-50 cursor-pointer';
export const btnPericol =
    'inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-xl text-xs font-semibold border border-red-500/30 hover:border-red-500/60 transition-all disabled:opacity-50 cursor-pointer';

export function delay(index: number, pas = 45): CSSProperties {
    return { animationDelay: `${Math.min(index, 14) * pas}ms` };
}

export function Card({
    children,
    className = '',
    style,
}: {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
}) {
    return (
        <section
            style={style}
            className={`bg-[#393E46]/70 border border-[#EEEEEE]/10 rounded-2xl p-5 shadow-sm shadow-black/10 backdrop-blur-sm ${className}`}
        >
            {children}
        </section>
    );
}

export function PageHeader({
    titlu,
    subtitlu,
    eticheta,
    actiuni,
}: {
    titlu: string;
    subtitlu?: ReactNode;
    eticheta?: string;
    actiuni?: ReactNode;
}) {
    return (
        <div className="anim-fade-up flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                {eticheta && (
                    <span className="inline-block text-[10px] font-mono uppercase tracking-[0.2em] text-[#FFD369] mb-2">
                        {eticheta}
                    </span>
                )}
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#EEEEEE]">{titlu}</h1>
                {subtitlu && <p className="text-sm text-[#EEEEEE]/60 mt-1 max-w-2xl">{subtitlu}</p>}
            </div>
            {actiuni && <div className="flex flex-wrap items-center gap-2">{actiuni}</div>}
        </div>
    );
}

export function StatCard({
    label,
    valoare,
    detaliu,
    ton = 'neutru',
    indicator,
    index = 0,
}: {
    label: string;
    valoare: ReactNode;
    detaliu?: ReactNode;
    ton?: 'neutru' | 'galben' | 'albastru' | 'verde' | 'rosu' | 'mov';
    indicator?: ReactNode;
    index?: number;
}) {
    const tonuri = {
        neutru: { border: 'border-[#EEEEEE]/10', text: 'text-[#EEEEEE]', label: 'text-[#EEEEEE]/70' },
        galben: { border: 'border-amber-500/25', text: 'text-amber-300', label: 'text-amber-300' },
        albastru: { border: 'border-sky-500/25', text: 'text-sky-300', label: 'text-sky-300' },
        verde: { border: 'border-emerald-500/25', text: 'text-emerald-300', label: 'text-emerald-300' },
        rosu: { border: 'border-red-500/30', text: 'text-red-300', label: 'text-red-300' },
        mov: { border: 'border-violet-500/25', text: 'text-violet-300', label: 'text-violet-300' },
    }[ton];

    return (
        <div
            style={delay(index, 60)}
            className={`anim-fade-up card-glow bg-[#393E46]/70 border ${tonuri.border} rounded-2xl p-5 backdrop-blur-sm shadow-sm transition-transform duration-300 hover:-translate-y-0.5`}
        >
            <div className={`flex items-center justify-between text-xs font-medium ${tonuri.label}`}>
                <span className="uppercase tracking-wide">{label}</span>
                {indicator}
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className={`text-3xl font-bold tabular-nums ${tonuri.text}`}>{valoare}</span>
                {detaliu && <span className="text-xs text-[#EEEEEE]/60 text-right">{detaliu}</span>}
            </div>
        </div>
    );
}

export function StatusBadge({ status }: { status: string }) {
    const cfg = getStatusConfig(status);
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border whitespace-nowrap ${cfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {LABEL_STATUS[status] ?? status}
        </span>
    );
}

export function TestBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center text-[10px] font-mono font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${getTestConfig(status).badge}`}>
            {LABEL_TEST[status] ?? status}
        </span>
    );
}

export function RolBadge({ rol }: { rol: string }) {
    return (
        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${getRoleBadge(rol)}`}>{rol}</span>
    );
}

export function CodBadge({ children }: { children: ReactNode }) {
    return (
        <span className="text-xs font-mono font-semibold text-[#FFD369] bg-[#222831] border border-[#FFD369]/30 px-2.5 py-1 rounded-lg whitespace-nowrap">
            {children}
        </span>
    );
}

export function Avatar({ nume, marime = 'md', inactiv = false }: { nume: string; marime?: 'sm' | 'md' | 'lg'; inactiv?: boolean }) {
    const dim = { sm: 'w-7 h-7 text-[10px]', md: 'w-9 h-9 text-xs', lg: 'w-14 h-14 text-base' }[marime];
    return (
        <div
            title={nume}
            className={`${dim} shrink-0 rounded-full bg-[#222831] border border-[#EEEEEE]/15 flex items-center justify-center font-bold ${
                inactiv ? 'text-[#EEEEEE]/30' : 'text-[#FFD369]'
            }`}
        >
            {initiale(nume)}
        </div>
    );
}

export function ProgressBar({
    valoare,
    culoare = 'bg-[#FFD369]',
    inaltime = 'h-1.5',
}: {
    valoare: number;
    culoare?: string;
    inaltime?: string;
}) {
    const v = Math.max(0, Math.min(100, valoare));
    return (
        <div className={`w-full ${inaltime} bg-[#222831] rounded-full overflow-hidden border border-[#EEEEEE]/10`}>
            <div className={`anim-grow-x h-full rounded-full ${culoare}`} style={{ width: `${v}%` }} />
        </div>
    );
}

/** Indicator circular (SVG) pentru procente. */
export function ProgressRing({ valoare, marime = 64, culoare = '#FFD369', eticheta }: { valoare: number; marime?: number; culoare?: string; eticheta?: string }) {
    const v = Math.max(0, Math.min(100, valoare));
    const r = (marime - 8) / 2;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative shrink-0" style={{ width: marime, height: marime }}>
            <svg width={marime} height={marime} className="-rotate-90">
                <circle cx={marime / 2} cy={marime / 2} r={r} stroke="#222831" strokeWidth="6" fill="none" />
                <circle
                    cx={marime / 2}
                    cy={marime / 2}
                    r={r}
                    stroke={culoare}
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c - (v / 100) * c}
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold font-mono tabular-nums">{Math.round(v)}%</span>
                {eticheta && <span className="text-[8px] uppercase tracking-wider text-[#EEEEEE]/50">{eticheta}</span>}
            </div>
        </div>
    );
}

export function EmptyState({ titlu, descriere, actiune }: { titlu: string; descriere?: string; actiune?: ReactNode }) {
    return (
        <div className="anim-fade-in bg-[#393E46]/40 border border-dashed border-[#EEEEEE]/20 rounded-2xl p-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#222831] border border-[#EEEEEE]/10 flex items-center justify-center text-[#FFD369]">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7h16M4 12h10M4 17h7" />
                </svg>
            </div>
            <p className="text-base font-medium text-[#EEEEEE]">{titlu}</p>
            {descriere && <p className="text-xs text-[#EEEEEE]/60 max-w-md mx-auto">{descriere}</p>}
            {actiune && <div className="pt-2">{actiune}</div>}
        </div>
    );
}

export function SectionTitle({ titlu, descriere, actiuni }: { titlu: string; descriere?: ReactNode; actiuni?: ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
                <h2 className="text-lg font-bold tracking-tight text-[#EEEEEE]">{titlu}</h2>
                {descriere && <p className="text-xs text-[#EEEEEE]/60 mt-0.5">{descriere}</p>}
            </div>
            {actiuni && <div className="flex flex-wrap items-center gap-2">{actiuni}</div>}
        </div>
    );
}
