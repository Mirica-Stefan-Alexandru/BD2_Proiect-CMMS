'use client';

import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { Rezultat } from '@/lib/actiuni';
import { btnPrimar } from '@/components/ui';

export type ActiuneForm = (stare: Rezultat, fd: FormData) => Promise<Rezultat>;

export function Spinner({ className = 'w-3.5 h-3.5' }: { className?: string }) {
    return (
        <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

export function SubmitButton({
    children,
    className = btnPrimar,
    textAsteptare,
    title,
}: {
    children: ReactNode;
    className?: string;
    textAsteptare?: string;
    title?: string;
}) {
    const { pending } = useFormStatus();
    return (
        <button type="submit" disabled={pending} className={className} title={title} aria-busy={pending}>
            {pending && <Spinner />}
            {pending && textAsteptare ? textAsteptare : children}
        </button>
    );
}

export function Mesaj({ stare, className = '' }: { stare: Rezultat; className?: string }) {
    // componenta este re-montata (key = stare.ts) la fiecare raspuns nou
    const [vizibil, setVizibil] = useState(true);
    useEffect(() => {
        if (!stare?.ok) return;
        const t = setTimeout(() => setVizibil(false), 4000);
        return () => clearTimeout(t);
    }, [stare]);

    if (!stare || !vizibil) return null;
    return (
        <div
            role={stare.ok ? 'status' : 'alert'}
            className={`anim-scale-in flex items-start gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
                stare.ok
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/60 border-red-500/40 text-red-200'
            } ${className}`}
        >
            <span aria-hidden="true">{stare.ok ? '✓' : '!'}</span>
            <span>{stare.mesaj}</span>
        </div>
    );
}

/**
 * Formular legat de un Server Action, cu stare de asteptare, mesaj de rezultat,
 * confirmare optionala si resetare dupa succes.
 */
export function ActionForm({
    action,
    children,
    className = '',
    confirmare,
    reseteaza = false,
    mesajSus = false,
    faraMesaj = false,
    onSucces,
}: {
    action: ActiuneForm;
    children: ReactNode;
    className?: string;
    confirmare?: string;
    reseteaza?: boolean;
    mesajSus?: boolean;
    faraMesaj?: boolean;
    onSucces?: () => void;
}) {
    const [stare, formAction] = useActionState(action, null);
    const ref = useRef<HTMLFormElement>(null);
    const onSuccesRef = useRef(onSucces);

    useEffect(() => {
        onSuccesRef.current = onSucces;
    });

    useEffect(() => {
        if (stare?.ok) {
            if (reseteaza) ref.current?.reset();
            onSuccesRef.current?.();
        }
    }, [stare, reseteaza]);

    return (
        <form
            ref={ref}
            action={formAction}
            className={className}
            onSubmit={(e) => {
                if (confirmare && !window.confirm(confirmare)) e.preventDefault();
            }}
        >
            {mesajSus && !faraMesaj && <Mesaj key={stare?.ts ?? 0} stare={stare} className="mb-3" />}
            {children}
            {!mesajSus && !faraMesaj && <Mesaj key={stare?.ts ?? 0} stare={stare} className="mt-3" />}
        </form>
    );
}

/** Fereastra modala simpla (dialog nativ) cu buton de deschidere. */
export function Modal({
    buton,
    titlu,
    children,
    clasaButon = btnPrimar,
    latime = 'max-w-lg',
    deschisInitial = false,
}: {
    buton: ReactNode;
    titlu: string;
    children: (inchide: () => void) => ReactNode;
    clasaButon?: string;
    latime?: string;
    deschisInitial?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const [deschis, setDeschis] = useState(deschisInitial);
    const inchide = useCallback(() => setDeschis(false), []);

    // starea React este sursa de adevar; dialogul nativ este sincronizat dupa render
    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (deschis && !d.open) d.showModal();
        if (!deschis && d.open) d.close();
    }, [deschis]);

    return (
        <>
            <button type="button" className={clasaButon} onClick={() => setDeschis(true)}>
                {buton}
            </button>
            <dialog
                ref={ref}
                onClose={() => setDeschis(false)}
                onClick={(e) => {
                    if (e.target === e.currentTarget) inchide();
                }}
                className={`m-auto w-[calc(100%-2rem)] ${latime} bg-transparent p-0 text-[#EEEEEE] backdrop:bg-black/60 backdrop:backdrop-blur-sm`}
            >
                {deschis && (
                    <div className="anim-scale-in bg-[#393E46] border border-[#EEEEEE]/15 rounded-2xl shadow-2xl shadow-black/50">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EEEEEE]/10">
                            <h3 className="text-sm font-bold tracking-tight">{titlu}</h3>
                            <button
                                type="button"
                                onClick={inchide}
                                className="w-7 h-7 rounded-lg text-[#EEEEEE]/60 hover:text-[#EEEEEE] hover:bg-[#222831] transition-colors cursor-pointer"
                                aria-label="Inchide"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-5">{children(inchide)}</div>
                    </div>
                )}
            </dialog>
        </>
    );
}
