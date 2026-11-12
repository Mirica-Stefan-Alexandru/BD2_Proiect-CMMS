import type { Metadata } from 'next';
import Link from 'next/link';
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
    EmptyState,
    inputCls,
    PageHeader,
    ProgressBar,
    RolBadge,
    StatCard,
    StatusBadge,
} from '@/components/ui';
import { formatData, zileRamase } from '@/lib/ui';
import { ROLURI_IN_PROIECT, rolInProiectPotrivit } from '@/lib/roluri';
import { AdaugaMembruForm, RolAsignareForm, StergeAsignareForm, type AngajatOptiune } from './FormulareAsignare';

export const instant = false;
export const metadata: Metadata = { title: 'Asignari proiecte' };

interface ProiectRand {
    id: number;
    cod_comanda: string;
    titlu: string;
    status: string;
    termen_limita: string;
}

interface AsignareRand {
    id: number;
    proiect_id: number;
    utilizator_id: number;
    rol_in_proiect: string;
    creat_la: string;
    nume: string;
    rol: string;
    activ: boolean;
    asignat_de_nume: string | null;
}

interface AngajatRand extends AngajatOptiune {
    departament: string | null;
    activ: boolean;
}

export default async function AsignariPage({ searchParams }: PageProps<'/admin/asignari'>) {
    const user = await requirePageUser(['MANAGER']);
    const sp = await searchParams;
    const q = typeof sp.q === 'string' ? sp.q.trim() : '';
    const filtru = typeof sp.filtru === 'string' ? sp.filtru : 'active';
    const proiectFocus = typeof sp.proiect === 'string' ? Number(sp.proiect) : null;

    const [proiecte, asignari, angajati] = await Promise.all([
        sql`
            SELECT id, cod_comanda, titlu, status, termen_limita
            FROM proiecte
            ORDER BY (status = 'FINALIZAT'), termen_limita
        ` as unknown as Promise<ProiectRand[]>,
        sql`
            SELECT a.id, a.proiect_id, a.utilizator_id, a.rol_in_proiect, a.creat_la,
                   u.nume, u.rol, u.activ, m.nume AS asignat_de_nume
            FROM asignari_proiect a
            JOIN utilizatori u      ON u.id = a.utilizator_id
            LEFT JOIN utilizatori m ON m.id = a.asignat_de
            ORDER BY CASE u.rol WHEN 'MANAGER' THEN 0 WHEN 'INGINER' THEN 1 ELSE 2 END, u.nume
        ` as unknown as Promise<AsignareRand[]>,
        sql`
            SELECT u.id, u.nume, u.rol, u.activ, d.denumire AS departament,
                   count(p.id) FILTER (WHERE p.status <> 'FINALIZAT')::int AS "proiecteActive"
            FROM utilizatori u
            LEFT JOIN departamente d     ON d.id = u.departament_id
            LEFT JOIN asignari_proiect a ON a.utilizator_id = u.id
            LEFT JOIN proiecte p         ON p.id = a.proiect_id
            GROUP BY u.id, d.denumire
            ORDER BY u.nume
        ` as unknown as Promise<AngajatRand[]>,
    ]);

    const echipaPe = (proiectId: number) => asignari.filter((a) => a.proiect_id === proiectId);
    const areInginer = (proiectId: number) => echipaPe(proiectId).some((a) => a.rol === 'INGINER');

    const nepotrivite = asignari.filter((a) => !rolInProiectPotrivit(a.rol_in_proiect, a.rol));
    const proiecteActive = proiecte.filter((p) => p.status !== 'FINALIZAT');
    const faraInginer = proiecteActive.filter((p) => !areInginer(p.id));
    const faraEchipa = proiecteActive.filter((p) => echipaPe(p.id).length === 0);
    const activi = angajati.filter((a) => a.activ);
    const inginerLiberi = activi.filter((a) => a.rol === 'INGINER' && a.proiecteActive === 0);
    const maxIncarcare = Math.max(1, ...activi.map((a) => a.proiecteActive));

    const lista = proiecte.filter((p) => {
        if (proiectFocus) return p.id === proiectFocus;
        if (filtru === 'active' && p.status === 'FINALIZAT') return false;
        if (filtru === 'fara_inginer' && (p.status === 'FINALIZAT' || areInginer(p.id))) return false;
        if (filtru === 'probleme' && !echipaPe(p.id).some((a) => !rolInProiectPotrivit(a.rol_in_proiect, a.rol))) return false;
        if (q) {
            const t = q.toLowerCase();
            return p.cod_comanda.toLowerCase().includes(t) || p.titlu.toLowerCase().includes(t);
        }
        return true;
    });

    const filtre = [
        { cod: 'active', label: 'Proiecte active' },
        { cod: 'fara_inginer', label: `Fara inginer (${faraInginer.length})` },
        { cod: 'probleme', label: `Roluri nepotrivite (${nepotrivite.length})` },
        { cod: 'toate', label: 'Toate' },
    ];

    return (
        <AppShell user={user}>
            <PageHeader
                eticheta="Administrare / Echipe"
                titlu="Asignari proiecte"
                subtitlu="Aloca inginerii si operatorii pe comenzi. Rolurile din santier sunt validate: testarea la rece si proiectarea pot fi atribuite doar inginerilor."
                actiuni={
                    <>
                        <Link href="/admin/proiecte" className={btnSecundar}>
                            + Proiect nou
                        </Link>
                        <Link href="/admin/echipa" className={btnSecundar}>
                            Overview echipa &rarr;
                        </Link>
                    </>
                }
            />

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard index={0} label="Proiecte active" valoare={proiecteActive.length} detaliu={`${asignari.length} asignari`} />
                <StatCard
                    index={1}
                    ton={faraInginer.length ? 'galben' : 'verde'}
                    label="Fara inginer"
                    valoare={faraInginer.length}
                    detaliu={faraEchipa.length ? `${faraEchipa.length} fara echipa` : 'Acoperire completa'}
                />
                <StatCard index={2} ton="albastru" label="Ingineri disponibili" valoare={inginerLiberi.length} detaliu="0 proiecte active" />
                <StatCard
                    index={3}
                    ton={nepotrivite.length ? 'rosu' : 'verde'}
                    label="Roluri nepotrivite"
                    valoare={nepotrivite.length}
                    detaliu={nepotrivite.length ? 'Necesita corectie' : 'Totul conform'}
                />
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
                <div className="space-y-4">
                    <Card className="anim-fade-up p-4!">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                                {filtre.map((f) => {
                                    const activ = !proiectFocus && filtru === f.cod;
                                    return (
                                        <Link
                                            key={f.cod}
                                            href={`/admin/asignari?filtru=${f.cod}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                                activ
                                                    ? 'bg-[#FFD369] text-[#222831] border-[#FFD369]'
                                                    : 'bg-[#222831]/70 text-[#EEEEEE]/70 border-[#EEEEEE]/10 hover:border-[#FFD369]/50 hover:text-[#EEEEEE]'
                                            }`}
                                        >
                                            {f.label}
                                        </Link>
                                    );
                                })}
                            </div>
                            <form method="GET" className="flex gap-2">
                                <input type="hidden" name="filtru" value={filtru} />
                                <input type="search" name="q" defaultValue={q} placeholder="Cauta proiect..." className={`${inputCls} md:w-56`} />
                                <button className={btnPrimar}>Cauta</button>
                            </form>
                        </div>
                        {proiectFocus && (
                            <p className="mt-3 text-xs text-[#EEEEEE]/60">
                                Afisezi un singur proiect.{' '}
                                <Link href="/admin/asignari" className="text-[#FFD369] hover:underline">
                                    Vezi toate proiectele
                                </Link>
                            </p>
                        )}
                    </Card>

                    {lista.length === 0 && (
                        <EmptyState titlu="Niciun proiect pentru filtrul ales." descriere="Schimba filtrul sau creeaza un proiect nou." />
                    )}

                    {lista.map((p, i) => {
                        const echipa = echipaPe(p.id);
                        const idsEchipa = new Set(echipa.map((a) => a.utilizator_id));
                        const disponibili = activi.filter((a) => !idsEchipa.has(a.id));
                        const zile = zileRamase(p.termen_limita);
                        const lipsaInginer = p.status !== 'FINALIZAT' && !areInginer(p.id);

                        return (
                            <Card key={p.id} style={delay(i + 1)} className="anim-fade-up card-glow space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div className="space-y-2 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <CodBadge>{p.cod_comanda}</CodBadge>
                                            <StatusBadge status={p.status} />
                                            {lipsaInginer && (
                                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border bg-amber-500/10 text-amber-300 border-amber-500/40">
                                                    LIPSA INGINER
                                                </span>
                                            )}
                                        </div>
                                        <Link href={`/proiecte/${p.id}`} className="block text-base font-bold text-[#EEEEEE] hover:text-[#FFD369] transition-colors truncate">
                                            {p.titlu}
                                        </Link>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-[10px] uppercase text-[#EEEEEE]/50">Termen</div>
                                        <div className="text-xs font-medium">{formatData(p.termen_limita)}</div>
                                        {p.status !== 'FINALIZAT' && (
                                            <div className={`text-[11px] font-mono ${zile < 0 ? 'text-red-400' : zile < 14 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                {zile < 0 ? `depasit ${-zile} zile` : `${zile} zile ramase`}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-[#EEEEEE]/10 overflow-hidden">
                                    {echipa.length === 0 ? (
                                        <p className="px-4 py-5 text-center text-xs text-[#EEEEEE]/50 bg-[#222831]/40">
                                            Nicio persoana asignata pe acest proiect.
                                        </p>
                                    ) : (
                                        <ul className="divide-y divide-[#EEEEEE]/10">
                                            {echipa.map((a) => {
                                                const potrivit = rolInProiectPotrivit(a.rol_in_proiect, a.rol);
                                                return (
                                                    <li
                                                        key={a.id}
                                                        className={`grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_220px_auto] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#222831]/50 ${
                                                            potrivit ? 'bg-[#222831]/30' : 'bg-red-500/5'
                                                        }`}
                                                    >
                                                        <Avatar nume={a.nume} marime="sm" inactiv={!a.activ} />
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <Link href={`/admin/echipa/${a.utilizator_id}`} className="text-sm font-semibold truncate hover:text-[#FFD369] transition-colors">
                                                                    {a.nume}
                                                                </Link>
                                                                <RolBadge rol={a.rol} />
                                                                {!a.activ && <span className="text-[10px] text-red-300">inactiv</span>}
                                                            </div>
                                                            <p className={`text-[10px] ${potrivit ? 'text-[#EEEEEE]/50' : 'text-red-300'}`}>
                                                                {potrivit
                                                                    ? `${ROLURI_IN_PROIECT[a.rol_in_proiect]?.descriere ?? a.rol_in_proiect}${a.asignat_de_nume ? ` · asignat de ${a.asignat_de_nume}` : ''}`
                                                                    : `Rolul ${ROLURI_IN_PROIECT[a.rol_in_proiect]?.label ?? a.rol_in_proiect} necesita ${ROLURI_IN_PROIECT[a.rol_in_proiect]?.roluriPermise.join('/') ?? '-'}`}
                                                            </p>
                                                        </div>
                                                        <div className="col-span-2 sm:col-span-1 flex items-center gap-2 sm:contents">
                                                            <div className="flex-1">
                                                                <RolAsignareForm id={a.id} rolCurent={a.rol_in_proiect} rolSistem={a.rol} />
                                                            </div>
                                                            <StergeAsignareForm id={a.id} nume={a.nume} />
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>

                                <AdaugaMembruForm proiectId={p.id} angajati={disponibili} />
                            </Card>
                        );
                    })}
                </div>

                <aside className="space-y-4 xl:sticky xl:top-36">
                    <Card className="anim-slide-in">
                        <h2 className="text-sm font-bold tracking-tight">Incarcare echipa</h2>
                        <p className="text-[11px] text-[#EEEEEE]/50 mb-4">Proiecte active pe fiecare angajat</p>
                        <ul className="space-y-3">
                            {activi
                                .filter((a) => a.rol !== 'MANAGER')
                                .sort((a, b) => b.proiecteActive - a.proiecteActive)
                                .map((a) => (
                                    <li key={a.id}>
                                        <Link href={`/admin/echipa/${a.id}`} className="group flex items-center gap-3">
                                            <Avatar nume={a.nume} marime="sm" />
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-semibold truncate group-hover:text-[#FFD369] transition-colors">{a.nume}</span>
                                                    <span className="text-[11px] font-mono text-[#EEEEEE]/70">{a.proiecteActive}</span>
                                                </div>
                                                <ProgressBar
                                                    valoare={(a.proiecteActive / maxIncarcare) * 100}
                                                    culoare={a.proiecteActive >= 3 ? 'bg-red-400' : a.rol === 'INGINER' ? 'bg-sky-400' : 'bg-emerald-400'}
                                                    inaltime="h-1"
                                                />
                                                <div className="text-[10px] text-[#EEEEEE]/40">
                                                    {a.rol} · {a.departament ?? 'fara departament'}
                                                </div>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                        </ul>
                    </Card>

                    <Card className="anim-slide-in" style={{ animationDelay: '120ms' }}>
                        <h2 className="text-sm font-bold tracking-tight mb-3">Roluri in santier</h2>
                        <dl className="space-y-2.5">
                            {Object.entries(ROLURI_IN_PROIECT).map(([cheie, def]) => (
                                <div key={cheie}>
                                    <dt className="text-xs font-semibold text-[#EEEEEE]">{def.label}</dt>
                                    <dd className="text-[10px] text-[#EEEEEE]/50">
                                        {def.descriere} · <span className="font-mono">{def.roluriPermise.join(' / ')}</span>
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </Card>
                </aside>
            </div>
        </AppShell>
    );
}
