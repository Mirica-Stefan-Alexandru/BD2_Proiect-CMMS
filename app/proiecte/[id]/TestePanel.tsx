'use client';

import { useMemo, useState } from 'react';
import { inputCls, TestBadge } from '@/components/ui';
import { formatDataOra, getTestConfig } from '@/lib/ui';
import { LABEL_TEST } from '@/lib/roluri';
import TestForm from './TestForm';
import type { ComponentaSchema, Permisiuni } from './tipuri';

const ORDINE = ['ROSU', 'NEGRU', 'GALBEN', 'NEVERIFICAT', 'VERDE'];

export default function TestePanel({ componente, permisiuni }: { componente: ComponentaSchema[]; permisiuni: Permisiuni }) {
    const [deschis, setDeschis] = useState<number | null>(null);
    const [filtru, setFiltru] = useState('');
    const [cautare, setCautare] = useState('');

    const sumar = useMemo(() => {
        const s: Record<string, number> = { VERDE: 0, GALBEN: 0, ROSU: 0, NEGRU: 0, NEVERIFICAT: 0 };
        for (const c of componente) s[c.ultim_status ?? 'NEVERIFICAT']++;
        return s;
    }, [componente]);

    const lista = componente
        .filter((c) => !filtru || (c.ultim_status ?? 'NEVERIFICAT') === filtru)
        .filter((c) => !cautare || c.tag_echipament.toLowerCase().includes(cautare.toLowerCase()) || c.descriere_tip.toLowerCase().includes(cautare.toLowerCase()))
        .sort(
            (a, b) =>
                ORDINE.indexOf(a.ultim_status ?? 'NEVERIFICAT') - ORDINE.indexOf(b.ultim_status ?? 'NEVERIFICAT') ||
                a.numar_pagina - b.numar_pagina ||
                a.tag_echipament.localeCompare(b.tag_echipament, 'ro', { numeric: true })
        );

    const total = componente.length;
    const conforme = sumar.VERDE;

    if (total === 0) {
        return (
            <p className="text-center text-xs text-[#EEEEEE]/50 py-10">
                Niciun reper pozitionat pe planse inca. Deschide tab-ul &quot;Scheme EPLAN&quot;, selecteaza un reper detectat in SVG si semneaza primul test.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {['VERDE', 'GALBEN', 'ROSU', 'NEGRU', 'NEVERIFICAT'].map((s) => {
                    const activ = filtru === s;
                    return (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setFiltru(activ ? '' : s)}
                            className={`text-left rounded-xl border px-3 py-2 transition-all cursor-pointer ${activ ? 'ring-1 ring-[#FFD369] border-[#FFD369]/60' : 'border-[#EEEEEE]/10 hover:border-[#EEEEEE]/30'} bg-[#222831]/60`}
                        >
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#EEEEEE]/60">
                                <span className="w-2 h-2 rounded-full" style={{ background: getTestConfig(s).stroke }} />
                                {LABEL_TEST[s]}
                            </div>
                            <div className="text-xl font-bold font-mono">{sumar[s]}</div>
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-[11px] text-[#EEEEEE]/60">
                    Conformitate: <span className="font-mono font-semibold text-emerald-300">{Math.round((conforme / total) * 100)}%</span> ({conforme}/{total} repere cu ultimul test VERDE)
                </p>
                <input type="search" value={cautare} onChange={(e) => setCautare(e.target.value)} placeholder="Cauta reper..." className={`${inputCls} sm:w-56`} />
            </div>

            <ul className="space-y-2">
                {lista.map((c) => {
                    const ultim = c.istoric[0];
                    const esteDeschis = deschis === c.id;
                    return (
                        <li key={c.id} className="rounded-xl border border-[#EEEEEE]/10 bg-[#222831]/40 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setDeschis(esteDeschis ? null : c.id)}
                                aria-expanded={esteDeschis}
                                className="w-full grid grid-cols-[90px_1fr_auto] sm:grid-cols-[110px_1fr_140px_150px_20px] items-center gap-3 px-3 py-2.5 text-left hover:bg-[#222831]/70 transition-colors cursor-pointer"
                            >
                                <span className="font-mono font-bold text-[#FFD369] text-xs">{c.tag_echipament}</span>
                                <span className="text-xs text-[#EEEEEE]/80 truncate">
                                    {c.descriere_tip}
                                    <span className="text-[10px] text-[#EEEEEE]/40"> · pag. {c.numar_pagina}</span>
                                </span>
                                <TestBadge status={c.ultim_status ?? 'NEVERIFICAT'} />
                                <span className="hidden sm:block text-[10px] font-mono text-[#EEEEEE]/50 text-right">
                                    {ultim ? `${ultim.verificat_de ?? '-'} · ${formatDataOra(ultim.data_verificare)}` : 'netestat'}
                                </span>
                                <span className={`hidden sm:block text-[#EEEEEE]/40 transition-transform duration-300 ${esteDeschis ? 'rotate-180' : ''}`}>▾</span>
                            </button>
                            {esteDeschis && (
                                <div className="anim-fade-in grid grid-cols-1 md:grid-cols-2 gap-4 px-3 pb-3 pt-1 border-t border-[#EEEEEE]/5">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-[#EEEEEE]/50 mb-2">Istoric ({c.istoric.length})</div>
                                        {c.istoric.length === 0 ? (
                                            <p className="text-[11px] text-[#EEEEEE]/50">Niciun test.</p>
                                        ) : (
                                            <ol className="relative border-l border-[#EEEEEE]/10 ml-1 space-y-2.5">
                                                {c.istoric.map((t) => (
                                                    <li key={t.id} className="ml-3 text-[11px]">
                                                        <span className="absolute -left-[4px] mt-1 w-2 h-2 rounded-full" style={{ background: getTestConfig(t.status_test).stroke }} />
                                                        <div className="flex items-center gap-2">
                                                            <TestBadge status={t.status_test} />
                                                            <span className="text-[10px] font-mono text-[#EEEEEE]/40">{formatDataOra(t.data_verificare)}</span>
                                                        </div>
                                                        {t.observatii && <p className="text-[#EEEEEE]/70 mt-0.5">{t.observatii}</p>}
                                                        <p className="text-[10px] text-[#EEEEEE]/40">semnat electronic: {t.verificat_de ?? '-'}</p>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}
                                    </div>
                                    <div>
                                        {permisiuni.poateTesta ? (
                                            <>
                                                <div className="text-[10px] uppercase tracking-wider text-[#EEEEEE]/50 mb-2">Test nou</div>
                                                <TestForm tinta={{ componentaId: c.id, tag: c.tag_echipament }} />
                                            </>
                                        ) : (
                                            <p className="text-[11px] text-[#EEEEEE]/50">Doar inginerii asignati pe proiect pot semna teste la rece.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
