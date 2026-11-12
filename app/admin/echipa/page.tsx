import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import sql from '@/lib/db';
import { requirePageUser } from '@/lib/session';
import AppShell from '@/components/AppShell';
import {
    Avatar,
    btnPrimar,
    btnSecundar,
    Card,
    delay,
    EmptyState,
    inputCls,
    PageHeader,
    ProgressBar,
    ProgressRing,
    RolBadge,
    StatCard,
} from '@/components/ui';
import { culoareIndice, EXPLICATIE_INDICE, getPerformanta, type PerformantaAngajat } from '@/lib/performanta';
import { formatRelativ, getStatusConfig } from '@/lib/ui';
import { ROLURI_IN_PROIECT, LABEL_STATUS } from '@/lib/roluri';

export const instant = false;
export const metadata: Metadata = { title: 'Echipa & Performanta' };

const SORTARI = {
    indice: { label: 'Indice performanta', fn: (a: PerformantaAngajat, b: PerformantaAngajat) => (b.indice ?? -1) - (a.indice ?? -1) },
    active: { label: 'Proiecte active', fn: (a: PerformantaAngajat, b: PerformantaAngajat) => b.proiecte_active - a.proiecte_active },
    activitate: {
        label: 'Activitate 30 zile',
        fn: (a: PerformantaAngajat, b: PerformantaAngajat) =>
            b.componente_verificate_30 + b.teste_semnate_30 - (a.componente_verificate_30 + a.teste_semnate_30),
    },
    nume: { label: 'Nume', fn: (a: PerformantaAngajat, b: PerformantaAngajat) => a.nume.localeCompare(b.nume, 'ro') },
} as const;

function Metrica({ label, valoare, ton = '' }: { label: string; valoare: ReactNode; ton?: string }) {
    return (
        <div className="bg-[#222831]/70 border border-[#EEEEEE]/10 rounded-xl px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider text-[#EEEEEE]/50">{label}</div>
            <div className={`text-sm font-bold font-mono tabular-nums ${ton}`}>{valoare}</div>
        </div>
    );
}

export default async function EchipaPage({ searchParams }: PageProps<'/admin/echipa'>) {
    const user = await requirePageUser(['MANAGER']);
    const sp = await searchParams;
    const rol = typeof sp.rol === 'string' ? sp.rol : '';
    const dep = typeof sp.dep === 'string' ? sp.dep : '';
    const q = typeof sp.q === 'string' ? sp.q.trim() : '';
    const sortKey = (typeof sp.sort === 'string' && sp.sort in SORTARI ? sp.sort : 'indice') as keyof typeof SORTARI;
    const inactivi = sp.inactivi === '1';

    const [toti, departamente] = await Promise.all([
        getPerformanta(),
        sql`SELECT id, denumire FROM departamente ORDER BY denumire` as unknown as Promise<{ id: number; denumire: string }[]>,
    ]);

    const lista = toti
        .filter((a) => inactivi || a.activ)
        .filter((a) => !rol || a.rol === rol)
        .filter((a) => !dep || String(a.departament_id) === dep)
        .filter((a) => !q || a.nume.toLowerCase().includes(q.toLowerCase()) || a.email.toLowerCase().includes(q.toLowerCase()))
        .sort(SORTARI[sortKey].fn);

    const activi = toti.filter((a) => a.activ);
    const cuIndice = activi.filter((a) => a.indice !== null);
    const indiceMediu = cuIndice.length ? Math.round(cuIndice.reduce((s, a) => s + (a.indice ?? 0), 0) / cuIndice.length) : null;
    const [kpi] = (await sql`
        SELECT
            (SELECT count(*) FROM proiecte WHERE status <> 'FINALIZAT')::int AS proiecte_active,
            (SELECT count(*) FROM componente_proiect WHERE verificat AND verificat_la > NOW() - INTERVAL '30 days')::int AS bifate_30,
            (SELECT count(*) FROM verificari_componente WHERE status_test <> 'NEVERIFICAT'
                AND data_verificare > NOW() - INTERVAL '30 days')::int AS teste_30
    `) as { proiecte_active: number; bifate_30: number; teste_30: number }[];
    const supraincarcati = activi.filter((a) => a.rol !== 'MANAGER' && a.proiecte_active >= 3).length;

    return (
        <AppShell user={user}>
            <PageHeader
                eticheta="Administrare / Resurse umane"
                titlu="Echipa & Performanta"
                subtitlu="Overview pentru fiecare angajat: proiectele la care lucreaza, volumul de verificari si calitatea executiei."
                actiuni={
                    <>
                        <a href="/api/rapoarte?tip=performanta&format=xlsx" className={btnSecundar}>
                            Export Excel
                        </a>
                        <a href="/api/rapoarte?tip=performanta&format=csv" className={btnSecundar}>
                            Export CSV
                        </a>
                        <Link href="/admin/utilizatori" className={btnPrimar}>
                            + Angajat nou
                        </Link>
                    </>
                }
            />

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard index={0} label="Angajati activi" valoare={activi.length} detaliu={`${toti.length - activi.length} inactivi`} />
                <StatCard index={1} ton="albastru" label="Proiecte active" valoare={kpi.proiecte_active} detaliu={supraincarcati ? `${supraincarcati} angajati cu 3+ proiecte` : 'Incarcare echilibrata'} />
                <StatCard index={2} ton="galben" label="Verificari 30 zile" valoare={kpi.bifate_30 + kpi.teste_30} detaliu={`${kpi.bifate_30} BOM · ${kpi.teste_30} teste`} />
                <StatCard
                    index={3}
                    ton={indiceMediu === null ? 'neutru' : indiceMediu >= 80 ? 'verde' : indiceMediu >= 55 ? 'galben' : 'rosu'}
                    label="Indice mediu echipa"
                    valoare={indiceMediu ?? '-'}
                    detaliu={<span title={EXPLICATIE_INDICE} className="underline decoration-dotted cursor-help">cum se calculeaza?</span>}
                />
            </section>

            <Card className="anim-fade-up p-4!" style={delay(4, 60)}>
                <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_160px_200px_190px_auto_auto] gap-2 items-center">
                    <input type="search" name="q" defaultValue={q} placeholder="Cauta dupa nume sau email..." className={inputCls} />
                    <select name="rol" defaultValue={rol} className={inputCls} aria-label="Rol">
                        <option value="">Toate rolurile</option>
                        <option value="INGINER">Ingineri</option>
                        <option value="OPERATOR">Operatori</option>
                        <option value="MANAGER">Manageri</option>
                    </select>
                    <select name="dep" defaultValue={dep} className={inputCls} aria-label="Departament">
                        <option value="">Toate departamentele</option>
                        {departamente.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.denumire}
                            </option>
                        ))}
                    </select>
                    <select name="sort" defaultValue={sortKey} className={inputCls} aria-label="Sortare">
                        {Object.entries(SORTARI).map(([k, s]) => (
                            <option key={k} value={k}>
                                Sortare: {s.label}
                            </option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-[#EEEEEE]/70 px-1 cursor-pointer">
                        <input type="checkbox" name="inactivi" value="1" defaultChecked={inactivi} className="accent-[#FFD369]" />
                        Inactivi
                    </label>
                    <div className="flex gap-2">
                        <button className={btnPrimar}>Aplica</button>
                        <Link href="/admin/echipa" className={btnSecundar}>
                            Reset
                        </Link>
                    </div>
                </form>
            </Card>

            {lista.length === 0 ? (
                <EmptyState titlu="Niciun angajat pentru filtrele alese." />
            ) : (
                <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {lista.map((a, i) => {
                        const c = culoareIndice(a.indice);
                        return (
                            <article
                                key={a.id}
                                style={delay(i + 5)}
                                className={`anim-fade-up card-glow group bg-[#393E46]/80 border rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 ${
                                    a.activ ? 'border-[#EEEEEE]/10 hover:border-[#FFD369]/50' : 'border-dashed border-[#EEEEEE]/15 opacity-70'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <Avatar nume={a.nume} marime="lg" inactiv={!a.activ} />
                                    <div className="flex-1 min-w-0">
                                        <Link href={`/admin/echipa/${a.id}`} className="block text-base font-bold truncate group-hover:text-[#FFD369] transition-colors">
                                            {a.nume}
                                        </Link>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                            <RolBadge rol={a.rol} />
                                            {!a.activ && (
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-red-500/40 text-red-300 bg-red-500/10">INACTIV</span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-[#EEEEEE]/50 mt-1 truncate">{a.departament ?? 'Fara departament'}</p>
                                    </div>
                                    <div title={EXPLICATIE_INDICE}>
                                        <ProgressRing valoare={a.indice ?? 0} marime={58} culoare={c.hex} eticheta={a.indice === null ? 'n/a' : 'indice'} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <Metrica label="Active" valoare={a.proiecte_active} ton={a.proiecte_active >= 3 ? 'text-red-300' : ''} />
                                    <Metrica label="Finalizate" valoare={a.proiecte_finalizate} ton="text-emerald-300" />
                                    <Metrica label="Depasite" valoare={a.proiecte_intarziate} ton={a.proiecte_intarziate ? 'text-red-300' : 'text-[#EEEEEE]/60'} />
                                    <Metrica label="BOM bifat" valoare={a.componente_verificate} />
                                    <Metrica label="Teste semnate" valoare={a.teste_semnate} />
                                    <Metrica label="Actiuni 30z" valoare={a.actiuni_30} />
                                </div>

                                <div className="space-y-2">
                                    {[
                                        { label: 'Livrare la termen', v: a.rataLivrare },
                                        { label: 'Calitate QC', v: a.calitate },
                                        { label: 'Productivitate 30z', v: a.productivitate },
                                    ].map((m) => (
                                        <div key={m.label}>
                                            <div className="flex justify-between text-[10px] mb-1">
                                                <span className="text-[#EEEEEE]/60">{m.label}</span>
                                                <span className={`font-mono font-semibold ${culoareIndice(m.v).text}`}>{m.v === null ? 'fara date' : `${m.v}%`}</span>
                                            </div>
                                            <ProgressBar valoare={m.v ?? 0} culoare={culoareIndice(m.v).bar} inaltime="h-1" />
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-1.5">
                                    <div className="text-[10px] uppercase tracking-wider text-[#EEEEEE]/50">Proiecte ({a.proiecte_total})</div>
                                    {a.proiecte.length === 0 ? (
                                        <p className="text-[11px] text-amber-300/80">Neasignat pe niciun proiect</p>
                                    ) : (
                                        <ul className="flex flex-wrap gap-1.5">
                                            {a.proiecte.slice(0, 6).map((p) => (
                                                <li key={p.id}>
                                                    <Link
                                                        href={`/proiecte/${p.id}`}
                                                        title={`${p.titlu} · ${LABEL_STATUS[p.status] ?? p.status} · ${ROLURI_IN_PROIECT[p.rol]?.label ?? p.rol}`}
                                                        className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-lg bg-[#222831] border border-[#EEEEEE]/10 hover:border-[#FFD369]/50 transition-colors"
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusConfig(p.status).bar}`} />
                                                        {p.cod}
                                                    </Link>
                                                </li>
                                            ))}
                                            {a.proiecte.length > 6 && <li className="text-[10px] text-[#EEEEEE]/50 self-center">+{a.proiecte.length - 6}</li>}
                                        </ul>
                                    )}
                                </div>

                                <div className="mt-auto pt-3 border-t border-[#EEEEEE]/10 flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-[#EEEEEE]/50">Ultima activitate: {formatRelativ(a.ultima_activitate)}</span>
                                    <Link href={`/admin/echipa/${a.id}`} className="text-xs font-semibold text-[#FFD369] hover:underline">
                                        Detalii &rarr;
                                    </Link>
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}
        </AppShell>
    );
}
