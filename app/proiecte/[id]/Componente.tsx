'use client';

import { useState, type ReactNode } from 'react';
import { ActionForm, Modal, SubmitButton } from '@/components/forms';
import { btnPericol, btnPrimar, btnSecundar, inputCls, labelCls } from '@/components/ui';
import { LABEL_STATUS, STATUSURI_PROIECT } from '@/lib/roluri';
import { incarcaPlansa, schimbaStatus, stergePlansa } from './actions';

export interface Tab {
    id: string;
    label: string;
    numar?: number;
    continut: ReactNode;
}

/** Taburi client: doar tabul activ este montat (vizualizatorul SVG are nevoie de layout vizibil). */
export function TaburiProiect({ taburi, initial }: { taburi: Tab[]; initial: string }) {
    const [activ, setActiv] = useState(taburi.some((t) => t.id === initial) ? initial : taburi[0].id);

    const schimba = (id: string) => {
        setActiv(id);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', id);
        window.history.replaceState(window.history.state, '', url);
    };

    return (
        <div className="space-y-5">
            <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-[#EEEEEE]/10">
                {taburi.map((t) => {
                    const sel = t.id === activ;
                    return (
                        <button
                            key={t.id}
                            role="tab"
                            type="button"
                            aria-selected={sel}
                            onClick={() => schimba(t.id)}
                            className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                                sel ? 'text-[#FFD369]' : 'text-[#EEEEEE]/60 hover:text-[#EEEEEE]'
                            }`}
                        >
                            {t.label}
                            {t.numar !== undefined && (
                                <span className={`px-1.5 rounded-md text-[10px] font-mono ${sel ? 'bg-[#FFD369]/15' : 'bg-[#222831]'}`}>{t.numar}</span>
                            )}
                            <span className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-[#FFD369] transition-all duration-300 ${sel ? 'opacity-100' : 'opacity-0 scale-x-0'}`} />
                        </button>
                    );
                })}
            </div>
            <div key={activ} role="tabpanel" className="anim-fade-in">
                {taburi.find((t) => t.id === activ)?.continut}
            </div>
        </div>
    );
}

export function StatusForm({ proiectId, status }: { proiectId: number; status: string }) {
    return (
        <ActionForm action={schimbaStatus} className="flex items-center gap-2">
            <input type="hidden" name="proiect_id" value={proiectId} />
            <select name="status" defaultValue={status} className={`${inputCls} w-44 py-1.5!`} aria-label="Status proiect">
                {STATUSURI_PROIECT.map((s) => (
                    <option key={s} value={s}>
                        {LABEL_STATUS[s]}
                    </option>
                ))}
            </select>
            <SubmitButton className={`${btnSecundar} py-1.5!`}>Schimba</SubmitButton>
        </ActionForm>
    );
}

export function FinalizeazaForm({ proiectId }: { proiectId: number }) {
    return (
        <ActionForm action={schimbaStatus} confirmare="Marchezi proiectul ca FINALIZAT (receptionat)?">
            <input type="hidden" name="proiect_id" value={proiectId} />
            <input type="hidden" name="status" value="FINALIZAT" />
            <SubmitButton className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#222831] rounded-xl text-xs font-bold transition-all cursor-pointer">
                Finalizeaza proiectul
            </SubmitButton>
        </ActionForm>
    );
}

export function IncarcaPlansaModal({ proiectId, urmatoareaPagina }: { proiectId: number; urmatoareaPagina: number }) {
    return (
        <Modal titlu="Incarca plansa din EPLAN (SVG sau PDF)" buton="+ Plansa SVG / PDF" clasaButon={btnPrimar}>
            {(inchide) => (
                <ActionForm action={incarcaPlansa} reseteaza onSucces={inchide} mesajSus className="space-y-3">
                    <input type="hidden" name="proiect_id" value={proiectId} />
                    <p className="text-xs text-[#EEEEEE]/65 leading-relaxed">
                        In EPLAN: File &rarr; Export &rarr; <b className="text-[#EEEEEE]">SVG</b> sau <b className="text-[#EEEEEE]">PDF</b>. PDF-ul este transformat automat in SVG,
                        iar fiecare pagina devine o plansa separata. Etichetele echipamentelor (ex: -KM1) raman text si sunt detectate automat.
                        Daca numarul paginii exista deja, plansa va fi inlocuita.
                    </p>
                    <div className="grid grid-cols-[110px_1fr] gap-3">
                        <div>
                            <label className={labelCls}>Prima pagina</label>
                            <input name="numar_pagina" type="number" min={1} required defaultValue={urmatoareaPagina} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Titlu pagina</label>
                            <input name="titlu_pagina" required maxLength={200} placeholder="Circuit forta motor M1" className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Fisier SVG sau PDF (max 8 MB)</label>
                        <input
                            name="fisier"
                            type="file"
                            accept=".svg,.pdf,image/svg+xml,application/pdf"
                            required
                            className="block w-full text-xs text-[#EEEEEE]/70 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#FFD369] file:text-[#222831] file:font-semibold file:cursor-pointer"
                        />
                    </div>
                    <p className="text-[11px] text-[#EEEEEE]/50">
                        Exemple:{' '}
                        <a href="/demo/CMD-2026-004_pagina-01.svg" download className="text-[#FFD369] hover:underline">
                            plansa demo (SVG)
                        </a>
                        {' · '}
                        <a href="/demo/plansa_exemplu.pdf" download className="text-[#FFD369] hover:underline">
                            plansa demo (PDF)
                        </a>
                    </p>
                    <div className="flex justify-end">
                        <SubmitButton textAsteptare="Se incarca si se converteste...">Incarca plansa</SubmitButton>
                    </div>
                </ActionForm>
            )}
        </Modal>
    );
}

export function StergePlansaForm({ id, pagina }: { id: number; pagina: number }) {
    return (
        <ActionForm action={stergePlansa} confirmare={`Stergi plansa ${pagina}? Se sterg si pozitiile si testele reperelor de pe ea.`} faraMesaj>
            <input type="hidden" name="id" value={id} />
            <SubmitButton className={`${btnPericol} px-2.5! py-1.5!`}>Sterge plansa</SubmitButton>
        </ActionForm>
    );
}
