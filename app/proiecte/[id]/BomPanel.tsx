'use client';

import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { ActionForm, Mesaj, Modal, SubmitButton } from '@/components/forms';
import { btnPericol, btnPrimar, btnSecundar, inputCls, labelCls, ProgressBar } from '@/components/ui';
import { formatDataOra } from '@/lib/ui';
import type { Rezultat } from '@/lib/actiuni';
import { adaugaComponenta, comutaComponenta, modificaComponenta, stergeComponenta } from './actions';
import ImportBom from './ImportBom';
import type { ComponentaBom, Permisiuni } from './tipuri';

type Filtru = 'toate' | 'neverificate' | 'verificate';

function CampuriComponenta({ c }: { c?: ComponentaBom }) {
    return (
        <>
            <div className="grid grid-cols-[1fr_100px] gap-3">
                <div>
                    <label className={labelCls}>Cod reper (Device tag)</label>
                    <input name="cod_reper" required maxLength={60} defaultValue={c?.cod_reper} placeholder="-KM1" className={`${inputCls} font-mono`} />
                </div>
                <div>
                    <label className={labelCls}>Cantitate</label>
                    <input name="cantitate" type="number" min={1} required defaultValue={c?.cantitate ?? 1} className={inputCls} />
                </div>
            </div>
            <div>
                <label className={labelCls}>Descriere</label>
                <input name="descriere" required maxLength={1000} defaultValue={c?.descriere} className={inputCls} />
            </div>
            <div>
                <label className={labelCls}>Producator</label>
                <input name="producator" maxLength={120} defaultValue={c?.producator ?? ''} className={inputCls} />
            </div>
            <div>
                <label className={labelCls}>Observatii</label>
                <textarea name="observatii" rows={2} maxLength={1000} defaultValue={c?.observatii ?? ''} className={inputCls} />
            </div>
        </>
    );
}

export default function BomPanel({
    proiectId,
    componente,
    permisiuni,
    userId,
    userNume,
}: {
    proiectId: number;
    componente: ComponentaBom[];
    permisiuni: Permisiuni;
    userId: number;
    userNume: string;
}) {
    const [filtru, setFiltru] = useState<Filtru>('toate');
    const [cautare, setCautare] = useState('');
    const [stare, setStare] = useState<Rezultat>(null);
    const [, startTransition] = useTransition();
    const [importDeschis, setImportDeschis] = useState(componente.length === 0 && permisiuni.poateEdita);

    const [optimiste, comutaOptimist] = useOptimistic(componente, (lista: ComponentaBom[], id: number) =>
        lista.map((c) =>
            c.id === id
                ? {
                      ...c,
                      verificat: !c.verificat,
                      verificat_de: c.verificat ? null : userId,
                      verificat_de_nume: c.verificat ? null : userNume,
                      verificat_la: c.verificat ? null : new Date().toISOString(),
                  }
                : c
        )
    );

    const comuta = (id: number) => {
        startTransition(async () => {
            comutaOptimist(id);
            const fd = new FormData();
            fd.set('id', String(id));
            setStare(await comutaComponenta(null, fd));
        });
    };

    const verificate = optimiste.filter((c) => c.verificat).length;
    const procent = optimiste.length ? Math.round((verificate / optimiste.length) * 100) : 0;

    const vizibile = useMemo(() => {
        const t = cautare.trim().toLowerCase();
        return optimiste.filter((c) => {
            if (filtru === 'verificate' && !c.verificat) return false;
            if (filtru === 'neverificate' && c.verificat) return false;
            if (!t) return true;
            return [c.cod_reper, c.descriere, c.producator ?? ''].some((v) => v.toLowerCase().includes(t));
        });
    }, [optimiste, filtru, cautare]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex-1 max-w-sm">
                        <div className="flex justify-between text-[11px] mb-1.5">
                            <span className="text-[#EEEEEE]/70">Checklist montaj & QC</span>
                            <span className="font-mono font-semibold">
                                {verificate}/{optimiste.length} · {procent}%
                            </span>
                        </div>
                        <ProgressBar valoare={procent} culoare={procent === 100 ? 'bg-emerald-400' : 'bg-[#FFD369]'} inaltime="h-2" />
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="search"
                        value={cautare}
                        onChange={(e) => setCautare(e.target.value)}
                        placeholder="Cauta reper, descriere..."
                        className={`${inputCls} w-full sm:w-56`}
                        aria-label="Cauta in BOM"
                    />
                    <div className="flex rounded-xl border border-[#EEEEEE]/15 overflow-hidden text-[11px] font-semibold">
                        {(['toate', 'neverificate', 'verificate'] as Filtru[]).map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFiltru(f)}
                                className={`px-3 py-2 capitalize transition-colors cursor-pointer ${
                                    filtru === f ? 'bg-[#FFD369] text-[#222831]' : 'bg-[#222831] text-[#EEEEEE]/70 hover:text-[#EEEEEE]'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    {permisiuni.poateEdita && (
                        <>
                            <button type="button" className={importDeschis ? btnPrimar : btnSecundar} onClick={() => setImportDeschis((v) => !v)}>
                                Import CSV EPLAN
                            </button>
                            <Modal titlu="Componenta noua" buton="+ Componenta" clasaButon={btnSecundar}>
                                {(inchide) => (
                                    <ActionForm action={adaugaComponenta} reseteaza onSucces={inchide} mesajSus className="space-y-3">
                                        <input type="hidden" name="proiect_id" value={proiectId} />
                                        <CampuriComponenta />
                                        <div className="flex justify-end">
                                            <SubmitButton>Adauga</SubmitButton>
                                        </div>
                                    </ActionForm>
                                )}
                            </Modal>
                        </>
                    )}
                </div>
            </div>

            {importDeschis && permisiuni.poateEdita && (
                <div className="anim-scale-in bg-[#222831]/40 border border-[#EEEEEE]/10 rounded-2xl p-4">
                    <ImportBom proiectId={proiectId} existente={componente.length} onGata={() => setImportDeschis(false)} />
                </div>
            )}

            <Mesaj key={stare?.ts ?? 0} stare={stare} />

            {optimiste.length === 0 ? (
                <p className="text-center text-xs text-[#EEEEEE]/50 py-10">
                    BOM-ul nu a fost importat inca.{permisiuni.poateEdita ? ' Foloseste importul CSV de mai sus.' : ' Inginerul proiectului il va importa din EPLAN.'}
                </p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-[#EEEEEE]/10">
                    <table className="w-full text-xs">
                        <thead className="bg-[#222831]/70">
                            <tr className="text-left text-[10px] uppercase tracking-wider text-[#EEEEEE]/50">
                                <th className="px-3 py-2.5 w-12">OK</th>
                                <th className="px-3 py-2.5">Reper</th>
                                <th className="px-3 py-2.5">Descriere</th>
                                <th className="px-3 py-2.5">Producator</th>
                                <th className="px-3 py-2.5 text-right">Cant.</th>
                                <th className="px-3 py-2.5">Verificat de</th>
                                {permisiuni.poateEdita && <th className="px-3 py-2.5 text-right">Actiuni</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EEEEEE]/5">
                            {vizibile.map((c) => (
                                <tr key={c.id} className={`transition-colors ${c.verificat ? 'bg-emerald-500/[0.04]' : ''} hover:bg-[#222831]/50`}>
                                    <td className="px-3 py-2">
                                        <button
                                            type="button"
                                            role="checkbox"
                                            aria-checked={c.verificat}
                                            aria-label={`${c.verificat ? 'Debifeaza' : 'Bifeaza'} ${c.cod_reper}`}
                                            disabled={!permisiuni.poateBifa}
                                            onClick={() => comuta(c.id)}
                                            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 active:scale-90 ${
                                                c.verificat
                                                    ? 'bg-emerald-500 border-emerald-400 text-[#222831] shadow-md shadow-emerald-500/30'
                                                    : 'border-[#EEEEEE]/25 hover:border-[#FFD369] text-transparent'
                                            }`}
                                        >
                                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="m5 12 5 5L20 7" />
                                            </svg>
                                        </button>
                                    </td>
                                    <td className="px-3 py-2 font-mono font-bold text-[#FFD369] whitespace-nowrap">{c.cod_reper}</td>
                                    <td className="px-3 py-2">
                                        <span className={c.verificat ? 'text-[#EEEEEE]/70' : 'text-[#EEEEEE]'}>{c.descriere}</span>
                                        {c.observatii && <span className="block text-[10px] text-[#EEEEEE]/45 mt-0.5">{c.observatii}</span>}
                                    </td>
                                    <td className="px-3 py-2 text-[#EEEEEE]/60 whitespace-nowrap">{c.producator ?? '-'}</td>
                                    <td className="px-3 py-2 text-right font-mono">{c.cantitate ?? 1}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {c.verificat ? (
                                            <>
                                                <span className="text-emerald-300 font-medium">{c.verificat_de_nume ?? 'necunoscut'}</span>
                                                <span className="block text-[10px] font-mono text-[#EEEEEE]/40">{c.verificat_la ? formatDataOra(c.verificat_la) : '-'}</span>
                                            </>
                                        ) : (
                                            <span className="text-[#EEEEEE]/40">-</span>
                                        )}
                                    </td>
                                    {permisiuni.poateEdita && (
                                        <td className="px-3 py-2">
                                            <div className="flex justify-end gap-1.5">
                                                <Modal titlu={`Editeaza ${c.cod_reper}`} buton="Editeaza" clasaButon={`${btnSecundar} px-2.5! py-1.5!`}>
                                                    {(inchide) => (
                                                        <ActionForm action={modificaComponenta} onSucces={inchide} mesajSus className="space-y-3">
                                                            <input type="hidden" name="id" value={c.id} />
                                                            <CampuriComponenta c={c} />
                                                            <div className="flex justify-end">
                                                                <SubmitButton className={btnPrimar}>Salveaza</SubmitButton>
                                                            </div>
                                                        </ActionForm>
                                                    )}
                                                </Modal>
                                                <ActionForm action={stergeComponenta} confirmare={`Stergi componenta ${c.cod_reper} din BOM?`} faraMesaj>
                                                    <input type="hidden" name="id" value={c.id} />
                                                    <SubmitButton className={`${btnPericol} px-2.5! py-1.5!`} title="Sterge">
                                                        ✕
                                                    </SubmitButton>
                                                </ActionForm>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {vizibile.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-8 text-center text-[#EEEEEE]/50">
                                        Nicio componenta pentru filtrul ales.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
