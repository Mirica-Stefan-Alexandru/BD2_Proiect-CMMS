'use client';

import { useRef, useState, useTransition } from 'react';
import { Mesaj, Spinner } from '@/components/forms';
import { btnPrimar, btnSecundar, inputCls } from '@/components/ui';
import { parseazaBom, type RezultatParsareBom } from '@/lib/csv';
import type { Rezultat } from '@/lib/actiuni';
import { importaBom } from './actions';

const MARIME_MAXIMA = 5 * 1024 * 1024;

/** Import "Parts list" exportat din EPLAN (CSV): parsare + previzualizare in browser, salvare pe server. */
export default function ImportBom({ proiectId, existente, onGata }: { proiectId: number; existente: number; onGata?: () => void }) {
    const [numeFisier, setNumeFisier] = useState('');
    const [rez, setRez] = useState<RezultatParsareBom | null>(null);
    const [mod, setMod] = useState<'actualizeaza' | 'inlocuieste'>('actualizeaza');
    const [stare, setStare] = useState<Rezultat>(null);
    const [pending, startTransition] = useTransition();
    const [trage, setTrage] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    async function citeste(f: File | undefined) {
        setStare(null);
        if (!f) return;
        if (f.size > MARIME_MAXIMA) {
            setRez({ randuri: [], erori: ['Fisierul depaseste 5 MB.'], coloane: {}, duplicateUnite: 0 });
            return;
        }
        setNumeFisier(f.name);
        const buf = await f.arrayBuffer();
        // EPLAN poate exporta UTF-8 sau Windows-1250 (Europa Centrala)
        let text = new TextDecoder('utf-8').decode(buf);
        if (text.includes('\uFFFD')) text = new TextDecoder('windows-1250').decode(buf);
        setRez(parseazaBom(text));
    }

    function importa() {
        if (!rez?.randuri.length) return;
        if (mod === 'inlocuieste' && existente > 0 && !window.confirm(`Inlocuiesti BOM-ul existent (${existente} componente)? Statusurile de verificare se pierd.`)) return;
        startTransition(async () => {
            const r = await importaBom(proiectId, rez.randuri, mod);
            setStare(r);
            if (r?.ok) {
                setRez(null);
                setNumeFisier('');
                if (inputRef.current) inputRef.current.value = '';
                onGata?.();
            }
        });
    }

    return (
        <div className="space-y-4">
            <label
                onDragOver={(e) => {
                    e.preventDefault();
                    setTrage(true);
                }}
                onDragLeave={() => setTrage(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setTrage(false);
                    void citeste(e.dataTransfer.files[0]);
                }}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl px-6 py-8 text-center cursor-pointer transition-all ${
                    trage ? 'border-[#FFD369] bg-[#FFD369]/10 scale-[1.01]' : 'border-[#EEEEEE]/20 hover:border-[#FFD369]/60 bg-[#222831]/50'
                }`}
            >
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#FFD369]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                    <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                    <path d="M12 11v6M9 14l3-3 3 3" />
                </svg>
                <span className="text-sm font-semibold">{numeFisier || 'Trage aici fisierul CSV sau apasa pentru a-l alege'}</span>
                <span className="text-[11px] text-[#EEEEEE]/50">
                    EPLAN: Utilities &rarr; Reports &rarr; Parts list &rarr; export CSV. Coloane recunoscute: Device tag, Description, Manufacturer, Quantity, Comment (si echivalentele RO/DE).
                </span>
                <input ref={inputRef} type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={(e) => void citeste(e.target.files?.[0])} />
            </label>

            <p className="text-[11px] text-[#EEEEEE]/50">
                Nu ai un export la indemana?{' '}
                <a href="/demo/EPLAN_parts-list_exemplu.csv" download className="text-[#FFD369] hover:underline">
                    Descarca un fisier exemplu
                </a>
                .
            </p>

            {rez && (
                <div className="anim-scale-in space-y-3">
                    <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono">{rez.randuri.length} componente valide</span>
                        {rez.duplicateUnite > 0 && (
                            <span className="px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 font-mono">{rez.duplicateUnite} randuri unite (acelasi reper)</span>
                        )}
                        {rez.erori.length > 0 && (
                            <span className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 font-mono">{rez.erori.length} randuri respinse</span>
                        )}
                        {Object.entries(rez.coloane).map(([camp, col]) => (
                            <span key={camp} className="px-2 py-1 rounded-lg bg-[#222831] border border-[#EEEEEE]/10 text-[#EEEEEE]/60">
                                {col} &rarr; <span className="font-mono text-[#EEEEEE]">{camp}</span>
                            </span>
                        ))}
                    </div>

                    {rez.erori.length > 0 && (
                        <ul className="max-h-24 overflow-auto text-[11px] text-red-300 bg-red-950/30 border border-red-500/20 rounded-xl p-3 space-y-0.5">
                            {rez.erori.slice(0, 50).map((e) => (
                                <li key={e}>{e}</li>
                            ))}
                        </ul>
                    )}

                    {rez.randuri.length > 0 && (
                        <>
                            <div className="overflow-auto max-h-64 rounded-xl border border-[#EEEEEE]/10">
                                <table className="w-full text-[11px]">
                                    <thead className="sticky top-0 bg-[#222831]">
                                        <tr className="text-left text-[10px] uppercase text-[#EEEEEE]/50">
                                            <th className="px-3 py-2">Reper</th>
                                            <th className="px-3 py-2">Descriere</th>
                                            <th className="px-3 py-2">Producator</th>
                                            <th className="px-3 py-2 text-right">Cant.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#EEEEEE]/5">
                                        {rez.randuri.slice(0, 200).map((r) => (
                                            <tr key={r.cod_reper}>
                                                <td className="px-3 py-1.5 font-mono font-semibold text-[#FFD369] whitespace-nowrap">{r.cod_reper}</td>
                                                <td className="px-3 py-1.5 text-[#EEEEEE]/80">{r.descriere}</td>
                                                <td className="px-3 py-1.5 text-[#EEEEEE]/60">{r.producator || '-'}</td>
                                                <td className="px-3 py-1.5 text-right font-mono">{r.cantitate}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {rez.randuri.length > 200 && (
                                    <p className="text-center text-[10px] text-[#EEEEEE]/50 py-2">... inca {rez.randuri.length - 200} randuri</p>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                <select value={mod} onChange={(e) => setMod(e.target.value as typeof mod)} className={`${inputCls} sm:max-w-sm`} aria-label="Mod import">
                                    <option value="actualizeaza">Actualizeaza / adauga (pastreaza bifele existente)</option>
                                    <option value="inlocuieste">Inlocuieste complet BOM-ul existent</option>
                                </select>
                                <div className="flex gap-2">
                                    <button type="button" className={btnSecundar} onClick={() => setRez(null)} disabled={pending}>
                                        Renunta
                                    </button>
                                    <button type="button" className={btnPrimar} onClick={importa} disabled={pending}>
                                        {pending && <Spinner />}
                                        {pending ? 'Se importa...' : `Importa ${rez.randuri.length} componente`}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            <Mesaj key={stare?.ts ?? 0} stare={stare} />
        </div>
    );
}
