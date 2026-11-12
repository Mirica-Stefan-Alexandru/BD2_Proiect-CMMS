import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import sql from '@/lib/db';
import { accesProiect, requirePageUser } from '@/lib/session';
import AppShell from '@/components/AppShell';
import {
    Avatar,
    btnPrimar,
    btnSecundar,
    Card,
    CodBadge,
    EmptyState,
    ProgressRing,
    RolBadge,
    StatusBadge,
} from '@/components/ui';
import { calculeazaProgres, formatData, formatDataOra, getStatusConfig, LABEL_ACTIUNE, zileRamase } from '@/lib/ui';
import { ROLURI_IN_PROIECT } from '@/lib/roluri';
import BomPanel from './BomPanel';
import SchemaViewer from './SchemaViewer';
import TestePanel from './TestePanel';
import { FinalizeazaForm, IncarcaPlansaModal, StatusForm, StergePlansaForm, TaburiProiect } from './Componente';
import type { ComponentaBom, ComponentaSchema, Plansa } from './tipuri';

export const instant = false;

export const metadata: Metadata = { title: 'Proiect' };

interface ProiectDetaliu {
    id: number;
    cod_comanda: string;
    titlu: string;
    descriere: string | null;
    status: string;
    termen_limita: string;
    creat_la: string;
    finalizat_la: string | null;
    creat_de: string | null;
}

export default async function ProiectPage({ params, searchParams }: PageProps<'/proiecte/[id]'>) {
    const user = await requirePageUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();
    const sp = await searchParams;

    const [proiect] = (await sql`
        SELECT p.id, p.cod_comanda, p.titlu, p.descriere, p.status, p.termen_limita, p.creat_la, p.finalizat_la,
               u.nume AS creat_de
        FROM proiecte p LEFT JOIN utilizatori u ON u.id = p.creat_de_id
        WHERE p.id = ${id}
    `) as ProiectDetaliu[];
    if (!proiect) notFound();

    const acces = await accesProiect(user, id);
    if (!acces.poateVedea) {
        return (
            <AppShell user={user}>
                <EmptyState
                    titlu="Nu ai acces la acest proiect."
                    descriere={`Proiectul ${proiect.cod_comanda} este vizibil doar echipei asignate. Cere managerului sa te adauge in echipa.`}
                    actiune={
                        <Link href="/" className={btnPrimar}>
                            Inapoi la panou
                        </Link>
                    }
                />
            </AppShell>
        );
    }

    const [echipa, bom, planse, componenteSchema, jurnal] = await Promise.all([
        sql`
            SELECT a.id, a.rol_in_proiect, a.creat_la, u.id AS utilizator_id, u.nume, u.rol, u.email
            FROM asignari_proiect a JOIN utilizatori u ON u.id = a.utilizator_id
            WHERE a.proiect_id = ${id}
            ORDER BY CASE u.rol WHEN 'MANAGER' THEN 0 WHEN 'INGINER' THEN 1 ELSE 2 END, u.nume
        ` as unknown as Promise<{ id: number; rol_in_proiect: string; creat_la: string; utilizator_id: number; nume: string; rol: string; email: string }[]>,
        sql`
            SELECT c.id, c.cod_reper, c.descriere, c.producator, c.cantitate, COALESCE(c.verificat, FALSE) AS verificat,
                   c.verificat_de, u.nume AS verificat_de_nume, c.verificat_la, c.observatii
            FROM componente_proiect c LEFT JOIN utilizatori u ON u.id = c.verificat_de
            WHERE c.proiect_id = ${id}
            ORDER BY c.cod_reper
        ` as unknown as Promise<ComponentaBom[]>,
        sql`
            SELECT id, numar_pagina, titlu_pagina, cale_fisier, (continut_svg IS NOT NULL) AS are_svg, creat_la
            FROM planse_schema WHERE proiect_id = ${id}
            ORDER BY numar_pagina
        ` as unknown as Promise<Plansa[]>,
        sql`
            SELECT cs.id, cs.plansa_id, ps.numar_pagina, cs.tag_echipament, cs.descriere_tip,
                   cs.pos_x::float8 AS pos_x, cs.pos_y::float8 AS pos_y,
                   cs.latime::float8 AS latime, cs.inaltime::float8 AS inaltime,
                   COALESCE(ist.istoric, '[]'::json) AS istoric,
                   ist.istoric -> 0 ->> 'status_test' AS ultim_status
            FROM componente_schema cs
            JOIN planse_schema ps ON ps.id = cs.plansa_id
            LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                           'id', v.id, 'status_test', v.status_test, 'observatii', v.observatii,
                           'data_verificare', v.data_verificare, 'verificat_de', u.nume
                       ) ORDER BY v.data_verificare DESC) AS istoric
                FROM (
                    SELECT * FROM verificari_componente
                    WHERE componenta_id = cs.id
                    ORDER BY data_verificare DESC
                    LIMIT 10
                ) v
                LEFT JOIN utilizatori u ON u.id = v.verificat_de_id
            ) ist ON TRUE
            WHERE ps.proiect_id = ${id}
            ORDER BY ps.numar_pagina, cs.tag_echipament
        ` as unknown as Promise<ComponentaSchema[]>,
        sql`
            SELECT j.id, j.actiune, j.detalii, j.creat_la, u.nume
            FROM jurnal_activitate j LEFT JOIN utilizatori u ON u.id = j.utilizator_id
            WHERE j.proiect_id = ${id}
            ORDER BY j.creat_la DESC
            LIMIT 30
        ` as unknown as Promise<{ id: number; actiune: string; detalii: string | null; creat_la: string; nume: string | null }[]>,
    ]);

    // plansa selectata (doar continutul ei SVG este incarcat)
    const plansaCeruta = typeof sp.plansa === 'string' ? Number(sp.plansa) : NaN;
    const plansaActiva = planse.find((p) => p.id === plansaCeruta) ?? planse[0] ?? null;
    let svgActiv: string | null = null;
    if (plansaActiva?.are_svg) {
        const rows = (await sql`SELECT continut_svg FROM planse_schema WHERE id = ${plansaActiva.id} AND proiect_id = ${id}`) as {
            continut_svg: string | null;
        }[];
        svgActiv = rows[0]?.continut_svg ?? null;
    }

    const verificate = bom.filter((c) => c.verificat).length;
    const progres = calculeazaProgres(proiect.status, bom.length, verificate);
    const testate = componenteSchema.filter((c) => c.ultim_status && c.ultim_status !== 'NEVERIFICAT');
    const conforme = componenteSchema.filter((c) => c.ultim_status === 'VERDE').length;
    const conformitate = componenteSchema.length ? Math.round((conforme / componenteSchema.length) * 100) : 0;
    const neconforme = componenteSchema.filter((c) => c.ultim_status === 'ROSU' || c.ultim_status === 'NEGRU').length;
    const zile = zileRamase(proiect.termen_limita);
    const cfg = getStatusConfig(proiect.status);
    const permisiuni = { poateBifa: acces.poateBifa, poateEdita: acces.poateEdita, poateTesta: acces.poateTesta };
    const poateRapoarte = user.rol === 'MANAGER' || user.rol === 'INGINER';
    const tabInitial = typeof sp.tab === 'string' ? sp.tab : typeof sp.plansa === 'string' ? 'scheme' : 'bom';

    const continutScheme = (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                    {planse.map((p) => (
                        <Link
                            key={p.id}
                            href={`/proiecte/${id}?tab=scheme&plansa=${p.id}`}
                            scroll={false}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                                plansaActiva?.id === p.id
                                    ? 'bg-[#FFD369] text-[#222831] border-[#FFD369]'
                                    : 'bg-[#222831]/70 text-[#EEEEEE]/70 border-[#EEEEEE]/10 hover:border-[#FFD369]/50'
                            }`}
                        >
                            <span className="font-mono">Pag. {p.numar_pagina}</span> · {p.titlu_pagina}
                            {!p.are_svg && <span className="ml-1 opacity-60">(raster)</span>}
                        </Link>
                    ))}
                </div>
                {acces.poateEdita && (
                    <div className="flex gap-2">
                        {plansaActiva && <StergePlansaForm id={plansaActiva.id} pagina={plansaActiva.numar_pagina} />}
                        <IncarcaPlansaModal proiectId={id} urmatoareaPagina={Math.max(0, ...planse.map((p) => p.numar_pagina)) + 1} />
                    </div>
                )}
            </div>
            {plansaActiva ? (
                <SchemaViewer
                    key={plansaActiva.id}
                    plansa={plansaActiva}
                    svg={svgActiv}
                    componenteSchema={componenteSchema.filter((c) => c.plansa_id === plansaActiva.id)}
                    bom={bom}
                    permisiuni={permisiuni}
                />
            ) : (
                <EmptyState
                    titlu="Nicio plansa incarcata."
                    descriere={
                        acces.poateEdita
                            ? 'Exporta schema din EPLAN in format SVG sau PDF si incarc-o cu butonul "+ Plansa SVG / PDF". Reperele vor fi detectate automat.'
                            : 'Inginerul proiectului va incarca schemele exportate din EPLAN.'
                    }
                />
            )}
        </div>
    );

    const continutEchipa = (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold">Echipa proiectului</h3>
                    {acces.esteManager && (
                        <Link href={`/admin/asignari?proiect=${id}`} className="text-xs text-[#FFD369] hover:underline">
                            Gestioneaza echipa &rarr;
                        </Link>
                    )}
                </div>
                {echipa.length === 0 ? (
                    <p className="text-xs text-[#EEEEEE]/50">Nicio persoana asignata.</p>
                ) : (
                    <ul className="space-y-2">
                        {echipa.map((m) => (
                            <li key={m.id} className="flex items-center gap-3 bg-[#222831]/50 border border-[#EEEEEE]/10 rounded-xl px-3 py-2.5">
                                <Avatar nume={m.nume} marime="sm" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        {acces.esteManager ? (
                                            <Link href={`/admin/echipa/${m.utilizator_id}`} className="text-sm font-semibold hover:text-[#FFD369] transition-colors">
                                                {m.nume}
                                            </Link>
                                        ) : (
                                            <span className="text-sm font-semibold">{m.nume}</span>
                                        )}
                                        <RolBadge rol={m.rol} />
                                        {m.utilizator_id === user.id && <span className="text-[10px] text-[#FFD369]">(tu)</span>}
                                    </div>
                                    <p className="text-[11px] text-[#EEEEEE]/50">{ROLURI_IN_PROIECT[m.rol_in_proiect]?.label ?? m.rol_in_proiect} · din {formatData(m.creat_la)}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div>
                <h3 className="text-sm font-bold mb-3">Jurnal proiect</h3>
                {jurnal.length === 0 ? (
                    <p className="text-xs text-[#EEEEEE]/50">Nicio activitate inregistrata.</p>
                ) : (
                    <ol className="relative border-l border-[#EEEEEE]/10 ml-1.5 space-y-3 max-h-[480px] overflow-auto pr-2">
                        {jurnal.map((j) => (
                            <li key={j.id} className="ml-4">
                                <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-[#FFD369] ring-4 ring-[#393E46]" />
                                <p className="text-xs">
                                    <span className="font-semibold">{j.nume ?? 'Sistem'}</span>{' '}
                                    <span className="text-[#EEEEEE]/70">{(LABEL_ACTIUNE[j.actiune] ?? j.actiune).toLowerCase()}</span>
                                    {j.detalii && <span className="font-mono text-[#FFD369]/90"> {j.detalii}</span>}
                                </p>
                                <time className="text-[10px] font-mono text-[#EEEEEE]/40">{formatDataOra(j.creat_la)}</time>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );

    return (
        <AppShell user={user}>
            <div className="anim-fade-up flex items-center gap-2 text-xs text-[#EEEEEE]/50">
                <Link href="/" className="hover:text-[#FFD369] transition-colors">
                    Panou Central
                </Link>
                <span>/</span>
                <span className="text-[#EEEEEE]/80 font-mono">{proiect.cod_comanda}</span>
            </div>

            <Card className="anim-fade-up card-glow">
                <div className="flex flex-col xl:flex-row xl:items-center gap-6">
                    <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <CodBadge>{proiect.cod_comanda}</CodBadge>
                            <StatusBadge status={proiect.status} />
                            {acces.rolInProiect && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#FFD369]/30 text-[#FFD369] bg-[#FFD369]/10">
                                    ROLUL TAU: {ROLURI_IN_PROIECT[acces.rolInProiect]?.label.toUpperCase() ?? acces.rolInProiect}
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{proiect.titlu}</h1>
                        {proiect.descriere && <p className="text-sm text-[#EEEEEE]/70 max-w-3xl">{proiect.descriere}</p>}
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#EEEEEE]/60">
                            <span>
                                Etapa: <span className={cfg.text}>{cfg.etapa}</span>
                            </span>
                            <span>
                                Termen: <span className="text-[#EEEEEE]">{formatData(proiect.termen_limita)}</span>{' '}
                                {proiect.status === 'FINALIZAT' ? (
                                    <span className="text-emerald-400">· livrat {formatData(proiect.finalizat_la)}</span>
                                ) : (
                                    <span className={`font-mono ${zile < 0 ? 'text-red-400' : zile < 14 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        · {zile < 0 ? `depasit cu ${-zile} zile` : `${zile} zile ramase`}
                                    </span>
                                )}
                            </span>
                            <span>
                                Creat de {proiect.creat_de ?? '-'} la {formatData(proiect.creat_la)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-5">
                        <div className="flex flex-col items-center gap-1">
                            <ProgressRing valoare={progres} marime={76} culoare={progres === 100 ? '#34d399' : '#FFD369'} eticheta="BOM" />
                            <span className="text-[10px] text-[#EEEEEE]/50 font-mono">
                                {verificate}/{bom.length}
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <ProgressRing valoare={conformitate} marime={76} culoare={neconforme ? '#f87171' : '#38bdf8'} eticheta="QC" />
                            <span className="text-[10px] text-[#EEEEEE]/50 font-mono">
                                {testate.length}/{componenteSchema.length} testate
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-[#EEEEEE]/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {acces.poateEdita && <StatusForm proiectId={id} status={proiect.status} />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {poateRapoarte && (
                            <>
                                <Link href={`/rapoarte/proiect/${id}`} className={btnSecundar}>
                                    Raport PDF
                                </Link>
                                <a href={`/api/rapoarte?tip=bom&proiect=${id}&format=xlsx`} className={btnSecundar}>
                                    BOM Excel
                                </a>
                            </>
                        )}
                        {acces.esteManager && (
                            <Link href={`/admin/asignari?proiect=${id}`} className={btnSecundar}>
                                Echipa ({echipa.length})
                            </Link>
                        )}
                    </div>
                </div>
            </Card>

            {acces.poateEdita && proiect.status !== 'FINALIZAT' && bom.length > 0 && verificate === bom.length && neconforme === 0 && (
                <div className="anim-scale-in flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4">
                    <div>
                        <p className="text-sm font-bold text-emerald-300">Toate componentele sunt verificate (100%).</p>
                        <p className="text-xs text-[#EEEEEE]/70">Nu exista teste neconforme deschise. Proiectul poate fi receptionat.</p>
                    </div>
                    <FinalizeazaForm proiectId={id} />
                </div>
            )}

            {neconforme > 0 && proiect.status !== 'FINALIZAT' && (
                <div className="anim-scale-in rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-xs text-red-200">
                    <span className="font-bold">{neconforme} repere neconforme</span> la testarea la rece. Remedierea si re-testarea sunt necesare inainte de receptie.
                </div>
            )}

            <Card className="anim-fade-up">
                <TaburiProiect
                    initial={tabInitial}
                    taburi={[
                        {
                            id: 'bom',
                            label: 'Lista materiale (BOM)',
                            numar: bom.length,
                            continut: <BomPanel proiectId={id} componente={bom} permisiuni={permisiuni} userId={user.id} userNume={user.nume} />,
                        },
                        { id: 'scheme', label: 'Scheme EPLAN', numar: planse.length, continut: continutScheme },
                        { id: 'teste', label: 'Testare la rece', numar: componenteSchema.length, continut: <TestePanel componente={componenteSchema} permisiuni={permisiuni} /> },
                        { id: 'echipa', label: 'Echipa & jurnal', numar: echipa.length, continut: continutEchipa },
                    ]}
                />
            </Card>
        </AppShell>
    );
}
