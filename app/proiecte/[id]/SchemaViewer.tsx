'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Mesaj, Spinner } from '@/components/forms';
import { btnSecundar, TestBadge } from '@/components/ui';
import { curataSvgBrowser } from '@/lib/svg';
import { formatDataOra, getTestConfig } from '@/lib/ui';
import type { Rezultat } from '@/lib/actiuni';
import { comutaComponenta } from './actions';
import TestForm from './TestForm';
import type { ComponentaBom, ComponentaSchema, Permisiuni, Plansa } from './tipuri';

const SVG_NS = 'http://www.w3.org/2000/svg';
// eticheta de echipament in stil EPLAN: -KM1, -QF10, -X1:3, -K1..K8
const REGEX_TAG = /^-[A-Z][A-Z0-9]*\d[A-Z0-9.:]*$/;

interface Dreptunghi {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface Reper {
    cod: string;
    aparitii: Dreptunghi[]; // coordonate in sistemul radacinii SVG
    procent: Dreptunghi; // prima aparitie, in procente din viewBox (salvata in componente_schema)
}

type StareMarker = 'VERDE' | 'GALBEN' | 'ROSU' | 'NEGRU' | 'BOM_OK' | 'IN_ASTEPTARE';

function culoriMarker(s: StareMarker) {
    if (s === 'BOM_OK') return { fill: 'rgba(16,185,129,0.10)', stroke: '#34d399', dash: '6 3' };
    if (s === 'IN_ASTEPTARE') return { fill: 'rgba(255,211,105,0.16)', stroke: '#e0b03f', dash: '' };
    const c = getTestConfig(s);
    return { fill: c.fill, stroke: c.stroke, dash: '' };
}

function potrivesteCod(text: string, coduri: string[]): string | null {
    for (const cod of coduri) {
        if (text === cod) return cod;
        // EPLAN poate afisa eticheta completa: =A1+S1-KM1
        if (text.endsWith(cod)) {
            const inainte = text[text.length - cod.length - 1];
            if (inainte && /[=+\s]/.test(inainte)) return cod;
        }
    }
    return REGEX_TAG.test(text) ? text : null;
}

export default function SchemaViewer({
    plansa,
    svg,
    componenteSchema,
    bom,
    permisiuni,
}: {
    plansa: Plansa;
    svg: string | null;
    componenteSchema: ComponentaSchema[];
    bom: ComponentaBom[];
    permisiuni: Permisiuni;
}) {
    const gazdaRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [repere, setRepere] = useState<Reper[]>([]);
    const [eroare, setEroare] = useState<string | null>(null);
    const [selectat, setSelectat] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [stareBom, setStareBom] = useState<Rezultat>(null);
    const [pendingBom, startTransition] = useTransition();

    const bomDupaCod = useMemo(() => new Map(bom.map((c) => [c.cod_reper, c])), [bom]);
    const schemaDupaTag = useMemo(() => new Map(componenteSchema.map((c) => [c.tag_echipament, c])), [componenteSchema]);
    // codurile lungi primele, ca "-K10" sa nu fie confundat cu "-K1"
    const coduriCunoscute = useMemo(
        () => [...new Set([...bom.map((c) => c.cod_reper), ...componenteSchema.map((c) => c.tag_echipament)])].sort((a, b) => b.length - a.length),
        [bom, componenteSchema]
    );
    const cheieCoduri = coduriCunoscute.join('|');

    // 1) inserare SVG igienizat + detectarea automata a etichetelor din desen
    useEffect(() => {
        const gazda = gazdaRef.current;
        if (!gazda || !svg) return;
        const radacina = curataSvgBrowser(svg);
        if (!radacina) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- rezultatul parsarii DOM
            setEroare('Fisierul SVG nu a putut fi interpretat.');
            return;
        }
        radacina.removeAttribute('width');
        radacina.removeAttribute('height');
        radacina.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        radacina.style.width = '100%';
        radacina.style.height = 'auto';
        radacina.style.display = 'block';
        gazda.replaceChildren(radacina);
        svgRef.current = radacina;

        const ctmRadacina = radacina.getScreenCTM();
        if (!ctmRadacina) return;
        const invers = ctmRadacina.inverse();
        let vb: Dreptunghi = { x: 0, y: 0, w: 0, h: 0 };
        const vbBase = radacina.viewBox?.baseVal;
        if (vbBase && vbBase.width > 0) vb = { x: vbBase.x, y: vbBase.y, w: vbBase.width, h: vbBase.height };
        else {
            const bb = radacina.getBBox();
            vb = { x: bb.x, y: bb.y, w: bb.width || 1, h: bb.height || 1 };
        }

        const gasite = new Map<string, Reper>();
        const frunze = Array.from(radacina.querySelectorAll<SVGTextContentElement>('text, tspan')).filter((el) => el.children.length === 0);
        for (const el of frunze) {
            const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (!t || t.length > 80) continue;
            const cod = potrivesteCod(t.replace(/\s/g, ''), coduriCunoscute) ?? potrivesteCod(t, coduriCunoscute);
            if (!cod) continue;

            const ctm = el.getScreenCTM();
            if (!ctm) continue;
            const bb = el.getBBox();
            const m = invers.multiply(ctm);
            const pct = [
                new DOMPoint(bb.x, bb.y),
                new DOMPoint(bb.x + bb.width, bb.y),
                new DOMPoint(bb.x, bb.y + bb.height),
                new DOMPoint(bb.x + bb.width, bb.y + bb.height),
            ].map((p) => p.matrixTransform(m));
            const xs = pct.map((p) => p.x);
            const ys = pct.map((p) => p.y);
            const pad = Math.max(3, (Math.max(...ys) - Math.min(...ys)) * 0.35);
            const r: Dreptunghi = {
                x: Math.min(...xs) - pad,
                y: Math.min(...ys) - pad,
                w: Math.max(...xs) - Math.min(...xs) + pad * 2,
                h: Math.max(...ys) - Math.min(...ys) + pad * 2,
            };

            const existent = gasite.get(cod);
            if (existent) existent.aparitii.push(r);
            else {
                const lim = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 100) / 100;
                gasite.set(cod, {
                    cod,
                    aparitii: [r],
                    procent: {
                        x: lim(((r.x - vb.x) / vb.w) * 100),
                        y: lim(((r.y - vb.y) / vb.h) * 100),
                        w: Math.max(0.01, lim((r.w / vb.w) * 100)),
                        h: Math.max(0.01, lim((r.h / vb.h) * 100)),
                    },
                });
            }
        }
        setEroare(null);
        setRepere([...gasite.values()].sort((a, b) => a.cod.localeCompare(b.cod, 'ro', { numeric: true })));
        // coduriCunoscute este reprezentat de cheieCoduri
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [svg, cheieCoduri]);

    const stareReper = (cod: string): StareMarker => {
        const test = schemaDupaTag.get(cod)?.ultim_status;
        if (test && test !== 'NEVERIFICAT') return test as StareMarker;
        return bomDupaCod.get(cod)?.verificat ? 'BOM_OK' : 'IN_ASTEPTARE';
    };

    // 2) desenarea chenarelor colorate peste desen (strat separat, deasupra plansei)
    useEffect(() => {
        const radacina = svgRef.current;
        if (!radacina) return;
        radacina.querySelector('#cmms-overlay')?.remove();
        const strat = document.createElementNS(SVG_NS, 'g');
        strat.setAttribute('id', 'cmms-overlay');
        for (const r of repere) {
            const c = culoriMarker(stareReper(r.cod));
            for (const a of r.aparitii) {
                const rect = document.createElementNS(SVG_NS, 'rect');
                rect.setAttribute('x', String(a.x));
                rect.setAttribute('y', String(a.y));
                rect.setAttribute('width', String(a.w));
                rect.setAttribute('height', String(a.h));
                rect.setAttribute('rx', '4');
                rect.setAttribute('fill', c.fill);
                rect.setAttribute('stroke', c.stroke);
                rect.setAttribute('stroke-width', '2.5');
                if (c.dash) rect.setAttribute('stroke-dasharray', c.dash);
                rect.setAttribute('class', 'svg-marker');
                rect.setAttribute('data-selectat', String(selectat === r.cod));
                rect.setAttribute('tabindex', '0');
                rect.setAttribute('role', 'button');
                rect.setAttribute('aria-label', `Reper ${r.cod}`);
                const titlu = document.createElementNS(SVG_NS, 'title');
                titlu.textContent = `${r.cod} - ${bomDupaCod.get(r.cod)?.descriere ?? 'reper din schema'}`;
                rect.appendChild(titlu);
                rect.addEventListener('click', () => setSelectat(r.cod));
                rect.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectat(r.cod);
                });
                strat.appendChild(rect);
            }
        }
        radacina.appendChild(strat);
    });

    // reperele afisate pentru plansele fara SVG (pozitii salvate in componente_schema)
    const repereAfisate: Reper[] = svg
        ? repere
        : componenteSchema.map((c) => ({
              cod: c.tag_echipament,
              aparitii: [],
              procent: { x: Number(c.pos_x), y: Number(c.pos_y), w: Number(c.latime), h: Number(c.inaltime) },
          }));

    const reperSelectat = repereAfisate.find((r) => r.cod === selectat) ?? null;
    const compBom = selectat ? bomDupaCod.get(selectat) : undefined;
    const compSchema = selectat ? schemaDupaTag.get(selectat) : undefined;
    const dinBom = repereAfisate.filter((r) => bomDupaCod.has(r.cod)).length;

    const comutaBom = (id: number) =>
        startTransition(async () => {
            const fd = new FormData();
            fd.set('id', String(id));
            setStareBom(await comutaComponenta(null, fd));
        });

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
            <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#EEEEEE]/60">
                        {[
                            ['IN_ASTEPTARE', 'In asteptare'],
                            ['BOM_OK', 'Montat (BOM bifat)'],
                            ['VERDE', 'Test conform'],
                            ['GALBEN', 'Remediere'],
                            ['ROSU', 'Neconform'],
                            ['NEGRU', 'Lipsa / gresit'],
                        ].map(([s, l]) => {
                            const c = culoriMarker(s as StareMarker);
                            return (
                                <span key={s} className="flex items-center gap-1.5">
                                    <span className="w-3 h-2.5 rounded-sm border-2" style={{ background: c.fill, borderColor: c.stroke, borderStyle: c.dash ? 'dashed' : 'solid' }} />
                                    {l}
                                </span>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button type="button" className={`${btnSecundar} px-2.5! py-1.5!`} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Micsoreaza">
                            −
                        </button>
                        <span className="text-[11px] font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
                        <button type="button" className={`${btnSecundar} px-2.5! py-1.5!`} onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Mareste">
                            +
                        </button>
                        <button type="button" className={`${btnSecundar} px-2.5! py-1.5!`} onClick={() => setZoom(1)}>
                            Potriveste
                        </button>
                    </div>
                </div>

                <div className="relative rounded-2xl border border-[#EEEEEE]/15 bg-[#1b2027] overflow-auto max-h-[72vh] shadow-inner shadow-black/40">
                    <div style={{ width: `${zoom * 100}%` }} className="transition-[width] duration-300 ease-out">
                        {svg ? (
                            <div ref={gazdaRef} className="bg-white" />
                        ) : (
                            <div className="relative w-full aspect-[1188/840] bg-[#f7f7f2] bg-[linear-gradient(to_right,#e5e5dc_1px,transparent_1px),linear-gradient(to_bottom,#e5e5dc_1px,transparent_1px)] bg-[size:2.5%_3.5%]">
                                <div className="absolute inset-x-0 bottom-0 h-[9%] border-t-2 border-black/70 flex items-center px-4 text-[10px] font-mono text-black/70">
                                    {plansa.titlu_pagina} · pagina {plansa.numar_pagina} · {plansa.cale_fisier}
                                </div>
                                {repereAfisate.map((r) => {
                                    const c = culoriMarker(stareReper(r.cod));
                                    return (
                                        <button
                                            key={r.cod}
                                            type="button"
                                            onClick={() => setSelectat(r.cod)}
                                            title={r.cod}
                                            className={`absolute rounded-md border-2 flex items-center justify-center text-[10px] font-mono font-bold text-black/80 transition-transform hover:scale-105 cursor-pointer ${
                                                selectat === r.cod ? 'anim-pulse-ring z-10' : ''
                                            }`}
                                            style={{
                                                left: `${r.procent.x}%`,
                                                top: `${r.procent.y}%`,
                                                width: `${r.procent.w}%`,
                                                height: `${r.procent.h}%`,
                                                background: c.fill,
                                                borderColor: c.stroke,
                                                borderStyle: c.dash ? 'dashed' : 'solid',
                                            }}
                                        >
                                            {r.cod}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {eroare && <p className="text-xs text-red-300">{eroare}</p>}
                <p className="text-[11px] text-[#EEEEEE]/50">
                    {svg
                        ? `${repereAfisate.length} repere detectate automat in desen (${dinBom} din BOM). Click pe un chenar pentru validare.`
                        : 'Plansa raster (fisierul original nu este stocat in aplicatie): pozitiile reperelor sunt afisate din baza de date. Incarca exportul SVG sau PDF din EPLAN pentru afisarea vectoriala.'}
                </p>

                {repereAfisate.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {repereAfisate.map((r) => {
                            const c = culoriMarker(stareReper(r.cod));
                            return (
                                <button
                                    key={r.cod}
                                    type="button"
                                    onClick={() => setSelectat(r.cod)}
                                    className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                        selectat === r.cod ? 'border-[#FFD369] bg-[#FFD369]/10 text-[#FFD369]' : 'border-[#EEEEEE]/10 bg-[#222831] hover:border-[#EEEEEE]/30'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full" style={{ background: c.stroke }} />
                                    {r.cod}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <aside className="bg-[#222831]/60 border border-[#EEEEEE]/10 rounded-2xl p-4 h-fit xl:sticky xl:top-36">
                {!reperSelectat ? (
                    <div className="text-center py-10 space-y-2">
                        <div className="mx-auto w-10 h-10 rounded-xl bg-[#393E46] flex items-center justify-center text-[#FFD369]">
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                            </svg>
                        </div>
                        <p className="text-sm font-semibold">Selecteaza un reper</p>
                        <p className="text-[11px] text-[#EEEEEE]/50">Click pe un chenar din schema pentru detalii, bifare montaj si testare la rece.</p>
                    </div>
                ) : (
                    <div key={reperSelectat.cod} className="anim-slide-in space-y-4">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <div className="text-xl font-mono font-extrabold text-[#FFD369]">{reperSelectat.cod}</div>
                                <div className="text-[11px] text-[#EEEEEE]/60">
                                    Pagina {plansa.numar_pagina}
                                    {reperSelectat.aparitii.length > 1 ? ` · ${reperSelectat.aparitii.length} aparitii` : ''}
                                </div>
                            </div>
                            <button type="button" onClick={() => setSelectat(null)} className="text-[#EEEEEE]/50 hover:text-[#EEEEEE] cursor-pointer" aria-label="Inchide">
                                ✕
                            </button>
                        </div>

                        {compBom ? (
                            <div className="space-y-2 text-xs">
                                <p className="text-[#EEEEEE]">{compBom.descriere}</p>
                                <p className="text-[11px] text-[#EEEEEE]/50">
                                    {compBom.producator ?? 'producator nespecificat'} · cantitate {compBom.cantitate ?? 1}
                                </p>
                                <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${compBom.verificat ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-[#EEEEEE]/10'}`}>
                                    <div className="text-[11px]">
                                        {compBom.verificat ? (
                                            <>
                                                <span className="text-emerald-300 font-semibold">Montat & bifat</span>
                                                <span className="block text-[10px] text-[#EEEEEE]/50">
                                                    {compBom.verificat_de_nume} · {formatDataOra(compBom.verificat_la)}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-[#EEEEEE]/70">Nebifat in checklist</span>
                                        )}
                                    </div>
                                    {permisiuni.poateBifa && (
                                        <button
                                            type="button"
                                            disabled={pendingBom}
                                            onClick={() => comutaBom(compBom.id)}
                                            className={`${compBom.verificat ? btnSecundar : 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#222831] rounded-xl text-xs font-bold transition-all cursor-pointer'} disabled:opacity-50`}
                                        >
                                            {pendingBom && <Spinner />}
                                            {compBom.verificat ? 'Debifeaza' : 'Bifeaza'}
                                        </button>
                                    )}
                                </div>
                                <Mesaj key={stareBom?.ts ?? 0} stare={stareBom} />
                            </div>
                        ) : (
                            <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                                Reperul apare in schema dar nu exista in BOM-ul importat.
                            </p>
                        )}

                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-wider text-[#EEEEEE]/50">Testare la rece</div>
                            {compSchema && compSchema.istoric.length > 0 ? (
                                <ul className="space-y-1.5 max-h-40 overflow-auto pr-1">
                                    {compSchema.istoric.map((t) => (
                                        <li key={t.id} className="text-[11px] bg-[#393E46]/50 rounded-lg px-2.5 py-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <TestBadge status={t.status_test} />
                                                <span className="text-[10px] font-mono text-[#EEEEEE]/40">{formatDataOra(t.data_verificare)}</span>
                                            </div>
                                            {t.observatii && <p className="text-[#EEEEEE]/70 mt-1">{t.observatii}</p>}
                                            <p className="text-[10px] text-[#EEEEEE]/40">semnat: {t.verificat_de ?? '-'}</p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-[11px] text-[#EEEEEE]/50">Niciun test inregistrat pentru acest reper.</p>
                            )}
                            {permisiuni.poateTesta ? (
                                <TestForm
                                    compact
                                    tinta={
                                        compSchema
                                            ? { componentaId: compSchema.id, tag: reperSelectat.cod }
                                            : {
                                                  plansaId: plansa.id,
                                                  tag: reperSelectat.cod,
                                                  descriere: compBom?.descriere.slice(0, 200),
                                                  pozitie: reperSelectat.procent,
                                              }
                                    }
                                />
                            ) : (
                                <p className="text-[10px] text-[#EEEEEE]/40">Testarea la rece este semnata de inginerul responsabil.</p>
                            )}
                        </div>
                    </div>
                )}
            </aside>
        </div>
    );
}
