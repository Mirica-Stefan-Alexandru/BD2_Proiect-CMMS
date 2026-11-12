import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import sql from '@/lib/db';
import { requirePageUser } from '@/lib/session';
import AppShell from '@/components/AppShell';
import {
    Avatar,
    btnPrimar,
    btnSecundar,
    Card,
    CodBadge,
    delay,
    ProgressBar,
    ProgressRing,
    RolBadge,
    SectionTitle,
    StatCard,
    StatusBadge,
    TestBadge,
} from '@/components/ui';
import { culoareIndice, EXPLICATIE_INDICE, getPerformanta } from '@/lib/performanta';
import { calculeazaProgres, formatData, formatDataOra, formatRelativ, getStatusConfig, LABEL_ACTIUNE, zileRamase } from '@/lib/ui';
import { ROLURI_IN_PROIECT, rolInProiectPotrivit } from '@/lib/roluri';

export const instant = false;
export const metadata: Metadata = { title: 'Profil angajat' };

export default async function AngajatPage({ params }: PageProps<'/admin/echipa/[id]'>) {
    const user = await requirePageUser(['MANAGER']);
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();

    const [perf] = await getPerformanta(id);
    if (!perf) notFound();

    const [zile, proiecte, bomRecent, testeRecente, jurnal] = await Promise.all([
        sql`
            SELECT to_char(z.zi, 'YYYY-MM-DD') AS zi,
                   (SELECT count(*) FROM componente_proiect c
                    WHERE c.verificat_de = ${id} AND c.verificat AND c.verificat_la::date = z.zi::date)::int AS bom,
                   (SELECT count(*) FROM verificari_componente v
                    WHERE v.verificat_de_id = ${id} AND v.status_test <> 'NEVERIFICAT'
                      AND v.data_verificare::date = z.zi::date)::int AS teste
            FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, INTERVAL '1 day') AS z(zi)
            ORDER BY z.zi
        ` as unknown as Promise<{ zi: string; bom: number; teste: number }[]>,
        sql`
            SELECT p.id, p.cod_comanda, p.titlu, p.status, p.termen_limita, a.rol_in_proiect, a.creat_la AS asignat_la,
                   COALESCE(c.total, 0)::int AS total, COALESCE(c.verificate, 0)::int AS verificate,
                   COALESCE(c.de_mine, 0)::int AS de_mine
            FROM asignari_proiect a
            JOIN proiecte p ON p.id = a.proiect_id
            LEFT JOIN LATERAL (
                SELECT count(*) AS total, count(*) FILTER (WHERE verificat) AS verificate,
                       count(*) FILTER (WHERE verificat AND verificat_de = ${id}) AS de_mine
                FROM componente_proiect WHERE proiect_id = p.id
            ) c ON TRUE
            WHERE a.utilizator_id = ${id}
            ORDER BY (p.status = 'FINALIZAT'), p.termen_limita
        ` as unknown as Promise<{
            id: number; cod_comanda: string; titlu: string; status: string; termen_limita: string;
            rol_in_proiect: string; asignat_la: string; total: number; verificate: number; de_mine: number;
        }[]>,
        sql`
            SELECT c.id, c.cod_reper, c.descriere, c.verificat_la, p.id AS proiect_id, p.cod_comanda
            FROM componente_proiect c JOIN proiecte p ON p.id = c.proiect_id
            WHERE c.verificat_de = ${id} AND c.verificat
            ORDER BY c.verificat_la DESC NULLS LAST
            LIMIT 10
        ` as unknown as Promise<{ id: number; cod_reper: string; descriere: string; verificat_la: string | null; proiect_id: number; cod_comanda: string }[]>,
        sql`
            SELECT v.id, v.status_test, v.observatii, v.data_verificare, cs.tag_echipament,
                   p.id AS proiect_id, p.cod_comanda
            FROM verificari_componente v
            JOIN componente_schema cs ON cs.id = v.componenta_id
            JOIN planse_schema ps     ON ps.id = cs.plansa_id
            JOIN proiecte p           ON p.id = ps.proiect_id
            WHERE v.verificat_de_id = ${id}
            ORDER BY v.data_verificare DESC
            LIMIT 10
        ` as unknown as Promise<{ id: number; status_test: string; observatii: string | null; data_verificare: string; tag_echipament: string; proiect_id: number; cod_comanda: string }[]>,
        sql`
            SELECT j.id, j.actiune, j.detalii, j.creat_la, p.id AS proiect_id, p.cod_comanda
            FROM jurnal_activitate j LEFT JOIN proiecte p ON p.id = j.proiect_id
            WHERE j.utilizator_id = ${id}
            ORDER BY j.creat_la DESC
            LIMIT 20
        ` as unknown as Promise<{ id: number; actiune: string; detalii: string | null; creat_la: string; proiect_id: number | null; cod_comanda: string | null }[]>,
    ]);

    const c = culoareIndice(perf.indice);
    const maxZi = Math.max(1, ...zile.map((z) => z.bom + z.teste));
    const totalZile = zile.reduce((s, z) => s + z.bom + z.teste, 0);

    return (
        <AppShell user={user}>
            <div className="anim-fade-up flex items-center gap-2 text-xs text-[#EEEEEE]/50">
                <Link href="/admin/echipa" className="hover:text-[#FFD369] transition-colors">
                    Echipa
                </Link>
                <span>/</span>
                <span className="text-[#EEEEEE]/80">{perf.nume}</span>
            </div>

            <Card className="anim-fade-up card-glow">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Avatar nume={perf.nume} marime="lg" inactiv={!perf.activ} />
                        <div className="min-w-0">
                            <h1 className="text-2xl font-extrabold tracking-tight truncate">{perf.nume}</h1>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <RolBadge rol={perf.rol} />
                                {!perf.activ && (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-red-500/40 text-red-300 bg-red-500/10">CONT INACTIV</span>
                                )}
                                <span className="text-xs text-[#EEEEEE]/60">{perf.email}</span>
                            </div>
                            <p className="text-xs text-[#EEEEEE]/50 mt-1">
                                {perf.departament ?? 'Fara departament'} · in sistem din {formatData(perf.creat_la)} · ultima activitate{' '}
                                {formatRelativ(perf.ultima_activitate)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <div title={EXPLICATIE_INDICE} className="flex items-center gap-3">
                            <ProgressRing valoare={perf.indice ?? 0} marime={84} culoare={c.hex} eticheta={perf.indice === null ? 'n/a' : 'indice'} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Link href={`/admin/utilizatori?edit=${perf.id}`} className={btnSecundar}>
                                Editeaza contul
                            </Link>
                            <Link href="/admin/asignari" className={btnPrimar}>
                                Asigneaza pe proiect
                            </Link>
                        </div>
                    </div>
                </div>
            </Card>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard index={0} ton="albastru" label="Proiecte active" valoare={perf.proiecte_active} detaliu={`${perf.proiecte_finalizate} finalizate`} />
                <StatCard
                    index={1}
                    ton={perf.rataLivrare === null ? 'neutru' : perf.rataLivrare >= 80 ? 'verde' : 'galben'}
                    label="Livrare la termen"
                    valoare={perf.rataLivrare === null ? '-' : `${perf.rataLivrare}%`}
                    detaliu={perf.proiecte_intarziate ? <span className="text-red-300">{perf.proiecte_intarziate} depasite</span> : 'Fara intarzieri'}
                />
                <StatCard
                    index={2}
                    ton={perf.calitate === null ? 'neutru' : perf.calitate >= 80 ? 'verde' : perf.calitate >= 55 ? 'galben' : 'rosu'}
                    label="Calitate QC"
                    valoare={perf.calitate === null ? '-' : `${perf.calitate}%`}
                    detaliu={`${perf.qc_conforme}/${perf.qc_executate} conforme`}
                />
                <StatCard
                    index={3}
                    ton="galben"
                    label="Verificari 30 zile"
                    valoare={perf.componente_verificate_30 + perf.teste_semnate_30}
                    detaliu={perf.productivitate === null ? 'n/a' : `${perf.productivitate}% din maxim`}
                />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
                <div className="space-y-6">
                    <Card className="anim-fade-up" style={delay(5, 60)}>
                        <SectionTitle
                            titlu="Activitate - ultimele 14 zile"
                            descriere={`${totalZile} verificari (componente BOM bifate + teste la rece semnate)`}
                        />
                        <div className="flex items-end gap-1.5 h-36" role="img" aria-label="Grafic activitate zilnica">
                            {zile.map((z, i) => {
                                const total = z.bom + z.teste;
                                return (
                                    <div key={z.zi} className="group flex-1 flex flex-col items-center gap-1 h-full justify-end">
                                        <span className="text-[9px] font-mono text-[#EEEEEE]/0 group-hover:text-[#EEEEEE]/80 transition-colors">{total}</span>
                                        <div
                                            className="w-full flex flex-col justify-end rounded-md overflow-hidden bg-[#222831] border border-[#EEEEEE]/5 anim-fade-up"
                                            style={{ height: `${Math.max(4, (total / maxZi) * 100)}%`, animationDelay: `${i * 35}ms` }}
                                            title={`${z.zi}: ${z.bom} componente, ${z.teste} teste`}
                                        >
                                            <div className="bg-sky-400/80" style={{ height: total ? `${(z.teste / total) * 100}%` : 0 }} />
                                            <div className="bg-[#FFD369]/85" style={{ height: total ? `${(z.bom / total) * 100}%` : 0 }} />
                                        </div>
                                        <span className="text-[9px] font-mono text-[#EEEEEE]/40">{z.zi.slice(8)}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-4 mt-3 text-[10px] text-[#EEEEEE]/60">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#FFD369]" /> Componente BOM</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sky-400" /> Teste la rece</span>
                        </div>
                    </Card>

                    <Card className="anim-fade-up" style={delay(6, 60)}>
                        <SectionTitle titlu={`Proiecte (${proiecte.length})`} descriere="Rolul in echipa, progresul BOM si contributia personala" />
                        {proiecte.length === 0 ? (
                            <p className="text-xs text-[#EEEEEE]/50">Angajatul nu este asignat pe niciun proiect.</p>
                        ) : (
                            <div className="overflow-x-auto -mx-2">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-left text-[10px] uppercase tracking-wider text-[#EEEEEE]/50">
                                            <th className="px-2 py-2 font-medium">Proiect</th>
                                            <th className="px-2 py-2 font-medium">Rol</th>
                                            <th className="px-2 py-2 font-medium">Status</th>
                                            <th className="px-2 py-2 font-medium w-40">Progres</th>
                                            <th className="px-2 py-2 font-medium text-right">Termen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#EEEEEE]/5">
                                        {proiecte.map((p) => {
                                            const progres = calculeazaProgres(p.status, p.total, p.verificate);
                                            const z = zileRamase(p.termen_limita);
                                            const potrivit = rolInProiectPotrivit(p.rol_in_proiect, perf.rol);
                                            return (
                                                <tr key={p.id} className="hover:bg-[#222831]/40 transition-colors">
                                                    <td className="px-2 py-2.5">
                                                        <Link href={`/proiecte/${p.id}`} className="group/l">
                                                            <span className="font-mono font-semibold text-[#FFD369]">{p.cod_comanda}</span>
                                                            <span className="block text-[#EEEEEE]/70 group-hover/l:text-[#EEEEEE] truncate max-w-[220px]">{p.titlu}</span>
                                                        </Link>
                                                    </td>
                                                    <td className="px-2 py-2.5">
                                                        <span className={potrivit ? '' : 'text-red-300'}>{ROLURI_IN_PROIECT[p.rol_in_proiect]?.label ?? p.rol_in_proiect}</span>
                                                        {!potrivit && <span className="block text-[10px] text-red-300/80">rol nepotrivit</span>}
                                                    </td>
                                                    <td className="px-2 py-2.5"><StatusBadge status={p.status} /></td>
                                                    <td className="px-2 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <ProgressBar valoare={progres} culoare={getStatusConfig(p.status).bar} />
                                                            <span className="font-mono w-9 text-right">{progres}%</span>
                                                        </div>
                                                        {p.de_mine > 0 && <span className="text-[10px] text-[#EEEEEE]/50">{p.de_mine} bifate de el/ea</span>}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right whitespace-nowrap">
                                                        <div>{formatData(p.termen_limita)}</div>
                                                        {p.status !== 'FINALIZAT' && (
                                                            <div className={`text-[10px] font-mono ${z < 0 ? 'text-red-400' : z < 14 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                                {z < 0 ? `depasit ${-z}z` : `${z} zile`}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="anim-fade-up" style={delay(7, 60)}>
                            <SectionTitle titlu="Componente bifate recent" />
                            {bomRecent.length === 0 ? (
                                <p className="text-xs text-[#EEEEEE]/50">Nicio componenta bifata.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {bomRecent.map((b) => (
                                        <li key={b.id} className="flex items-start justify-between gap-3 text-xs">
                                            <div className="min-w-0">
                                                <span className="font-mono font-semibold text-[#FFD369]">{b.cod_reper}</span>{' '}
                                                <span className="text-[#EEEEEE]/70 line-clamp-1">{b.descriere}</span>
                                            </div>
                                            <Link href={`/proiecte/${b.proiect_id}`} className="shrink-0 text-right text-[10px] font-mono text-[#EEEEEE]/50 hover:text-[#FFD369]">
                                                {b.cod_comanda}
                                                <span className="block">{b.verificat_la ? formatRelativ(b.verificat_la) : '-'}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                        <Card className="anim-fade-up" style={delay(8, 60)}>
                            <SectionTitle titlu="Teste la rece semnate" />
                            {testeRecente.length === 0 ? (
                                <p className="text-xs text-[#EEEEEE]/50">Niciun test semnat.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {testeRecente.map((t) => (
                                        <li key={t.id} className="flex items-start justify-between gap-3 text-xs">
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-semibold">{t.tag_echipament}</span>
                                                    <TestBadge status={t.status_test} />
                                                </div>
                                                {t.observatii && <p className="text-[#EEEEEE]/60 line-clamp-1">{t.observatii}</p>}
                                            </div>
                                            <Link href={`/proiecte/${t.proiect_id}`} className="shrink-0 text-right text-[10px] font-mono text-[#EEEEEE]/50 hover:text-[#FFD369]">
                                                {t.cod_comanda}
                                                <span className="block">{formatRelativ(t.data_verificare)}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>
                </div>

                <Card className="anim-slide-in lg:sticky lg:top-36">
                    <SectionTitle titlu="Jurnal activitate" descriere="Ultimele 20 de actiuni" />
                    {jurnal.length === 0 ? (
                        <p className="text-xs text-[#EEEEEE]/50">Nicio activitate inregistrata.</p>
                    ) : (
                        <ol className="relative border-l border-[#EEEEEE]/10 ml-1.5 space-y-4">
                            {jurnal.map((j) => (
                                <li key={j.id} className="ml-4">
                                    <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-[#FFD369] ring-4 ring-[#393E46]" />
                                    <p className="text-xs font-semibold">{LABEL_ACTIUNE[j.actiune] ?? j.actiune}</p>
                                    {(j.detalii || j.cod_comanda) && (
                                        <p className="text-[11px] text-[#EEEEEE]/60">
                                            {j.cod_comanda && j.proiect_id && (
                                                <Link href={`/proiecte/${j.proiect_id}`} className="mr-1.5">
                                                    <CodBadge>{j.cod_comanda}</CodBadge>
                                                </Link>
                                            )}
                                            {j.detalii}
                                        </p>
                                    )}
                                    <time className="text-[10px] font-mono text-[#EEEEEE]/40">{formatDataOra(j.creat_la)}</time>
                                </li>
                            ))}
                        </ol>
                    )}
                </Card>
            </div>
        </AppShell>
    );
}
