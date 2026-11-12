import type { Metadata } from 'next';
import Link from 'next/link';
import sql from '@/lib/db';
import { requirePageUser } from '@/lib/session';
import AppShell from '@/components/AppShell';
import { btnPrimar, btnSecundar, Card, CodBadge, delay, EmptyState, inputCls, PageHeader, ProgressBar, StatusBadge } from '@/components/ui';
import { calculeazaProgres, dataPentruInput, formatData, getStatusConfig, zileRamase } from '@/lib/ui';
import { LABEL_STATUS, STATUSURI_PROIECT } from '@/lib/roluri';
import { ProiectModal, StergeProiectForm } from './FormulareProiect';

export const instant = false;
export const metadata: Metadata = { title: 'Administrare proiecte' };

interface ProiectAdmin {
    id: number;
    cod_comanda: string;
    titlu: string;
    descriere: string | null;
    status: string;
    termen_limita: string;
    creat_la: string;
    creat_de: string | null;
    echipa: number;
    ingineri: number;
    componente: number;
    verificate: number;
    planse: number;
}

export default async function ProiecteAdminPage({ searchParams }: PageProps<'/admin/proiecte'>) {
    const user = await requirePageUser(['MANAGER']);
    const sp = await searchParams;
    const q = typeof sp.q === 'string' ? sp.q.trim() : '';
    const status = typeof sp.status === 'string' ? sp.status : '';

    const proiecte = (await sql`
        SELECT p.id, p.cod_comanda, p.titlu, p.descriere, p.status, p.termen_limita, p.creat_la,
               u.nume AS creat_de,
               (SELECT count(*) FROM asignari_proiect a WHERE a.proiect_id = p.id)::int AS echipa,
               (SELECT count(*) FROM asignari_proiect a JOIN utilizatori x ON x.id = a.utilizator_id
                 WHERE a.proiect_id = p.id AND x.rol = 'INGINER')::int AS ingineri,
               (SELECT count(*) FROM componente_proiect c WHERE c.proiect_id = p.id)::int AS componente,
               (SELECT count(*) FROM componente_proiect c WHERE c.proiect_id = p.id AND c.verificat)::int AS verificate,
               (SELECT count(*) FROM planse_schema s WHERE s.proiect_id = p.id)::int AS planse
        FROM proiecte p
        LEFT JOIN utilizatori u ON u.id = p.creat_de_id
        WHERE (${status} = '' OR p.status = ${status})
          AND (${q} = '' OR p.cod_comanda ILIKE '%' || ${q} || '%' OR p.titlu ILIKE '%' || ${q} || '%')
        ORDER BY p.creat_la DESC, p.id DESC
    `) as ProiectAdmin[];

    // sugestie pentru urmatorul cod de comanda: CMD-<an>-<nr+1>
    const [ultim] = (await sql`
        SELECT COALESCE(max(split_part(cod_comanda, '-', 3)::int), 0) AS nr,
               to_char(CURRENT_DATE, 'YYYY') AS an
        FROM proiecte WHERE cod_comanda ~ '^CMD-[0-9]{4}-[0-9]+$'
    `) as { nr: number; an: string }[];
    const sugestieCod = `CMD-${ultim?.an ?? '2026'}-${String((ultim?.nr ?? 0) + 1).padStart(3, '0')}`;

    return (
        <AppShell user={user}>
            <PageHeader
                eticheta="Administrare / Comenzi"
                titlu="Proiecte"
                subtitlu="Creeaza, editeaza si sterge comenzile de tablouri. Dupa creare, aloca echipa din pagina Asignari si importa BOM-ul din EPLAN in pagina proiectului."
                actiuni={<ProiectModal sugestieCod={sugestieCod} />}
            />

            <Card className="anim-fade-up p-4!">
                <form method="GET" className="flex flex-col sm:flex-row gap-2">
                    <input type="search" name="q" defaultValue={q} placeholder="Cauta cod sau titlu..." className={`${inputCls} sm:max-w-xs`} />
                    <select name="status" defaultValue={status} className={`${inputCls} sm:max-w-[200px]`} aria-label="Status">
                        <option value="">Toate statusurile</option>
                        {STATUSURI_PROIECT.map((s) => (
                            <option key={s} value={s}>
                                {LABEL_STATUS[s]}
                            </option>
                        ))}
                    </select>
                    <button className={btnPrimar}>Filtreaza</button>
                    {(q || status) && (
                        <Link href="/admin/proiecte" className={btnSecundar}>
                            Reset
                        </Link>
                    )}
                </form>
            </Card>

            {proiecte.length === 0 ? (
                <EmptyState titlu="Niciun proiect gasit." descriere="Creeaza primul proiect cu butonul de mai sus." />
            ) : (
                <Card className="anim-fade-up p-0! overflow-hidden" style={delay(2, 60)}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-[#222831]/60">
                                <tr className="text-left text-[10px] uppercase tracking-wider text-[#EEEEEE]/50">
                                    <th className="px-4 py-3 font-medium">Comanda</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Termen</th>
                                    <th className="px-4 py-3 font-medium">Echipa</th>
                                    <th className="px-4 py-3 font-medium w-44">BOM / Progres</th>
                                    <th className="px-4 py-3 font-medium">Planse</th>
                                    <th className="px-4 py-3 font-medium text-right">Actiuni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EEEEEE]/5">
                                {proiecte.map((p, i) => {
                                    const z = zileRamase(p.termen_limita);
                                    const progres = calculeazaProgres(p.status, p.componente, p.verificate);
                                    return (
                                        <tr key={p.id} style={delay(i, 30)} className="anim-fade-in hover:bg-[#222831]/40 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <CodBadge>{p.cod_comanda}</CodBadge>
                                                </div>
                                                <Link href={`/proiecte/${p.id}`} className="block mt-1.5 font-semibold text-[#EEEEEE] hover:text-[#FFD369] transition-colors max-w-xs truncate">
                                                    {p.titlu}
                                                </Link>
                                                <span className="text-[10px] text-[#EEEEEE]/40">
                                                    creat {formatData(p.creat_la)}
                                                    {p.creat_de ? ` de ${p.creat_de}` : ''}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div>{formatData(p.termen_limita)}</div>
                                                {p.status !== 'FINALIZAT' && (
                                                    <div className={`text-[10px] font-mono ${z < 0 ? 'text-red-400' : z < 14 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                        {z < 0 ? `depasit ${-z} zile` : `${z} zile`}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link href={`/admin/asignari?proiect=${p.id}`} className="hover:text-[#FFD369] transition-colors">
                                                    <span className="font-mono">{p.echipa}</span> persoane
                                                </Link>
                                                {p.ingineri === 0 && p.status !== 'FINALIZAT' && (
                                                    <span className="block text-[10px] text-amber-300">fara inginer</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <ProgressBar valoare={progres} culoare={getStatusConfig(p.status).bar} />
                                                    <span className="font-mono w-9 text-right">{progres}%</span>
                                                </div>
                                                <span className="text-[10px] text-[#EEEEEE]/50">
                                                    {p.componente ? `${p.verificate}/${p.componente} componente` : 'BOM neimportat'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono">{p.planse}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link href={`/proiecte/${p.id}`} className={`${btnSecundar} px-2.5! py-1.5!`}>
                                                        Deschide
                                                    </Link>
                                                    <ProiectModal
                                                        proiect={{
                                                            id: p.id,
                                                            cod_comanda: p.cod_comanda,
                                                            titlu: p.titlu,
                                                            descriere: p.descriere,
                                                            status: p.status,
                                                            termen: dataPentruInput(p.termen_limita),
                                                        }}
                                                    />
                                                    <StergeProiectForm id={p.id} cod={p.cod_comanda} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </AppShell>
    );
}
