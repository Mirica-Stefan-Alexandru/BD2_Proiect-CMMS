import type { Metadata } from 'next';
import Link from 'next/link';
import sql from '@/lib/db';
import { requirePageUser } from '@/lib/session';
import AppShell from '@/components/AppShell';
import { Avatar, btnPrimar, btnSecundar, Card, delay, inputCls, PageHeader, RolBadge, SectionTitle, StatCard } from '@/components/ui';
import { formatData, formatRelativ } from '@/lib/ui';
import { ROLURI } from '@/lib/roluri';
import {
    DepartamentNouForm,
    DepartamentRand,
    StergeUtilizatorForm,
    UtilizatorModal,
    type Departament,
} from './FormulareUtilizator';

export const instant = false;
export const metadata: Metadata = { title: 'Utilizatori & departamente' };

interface UtilizatorRand {
    id: number;
    nume: string;
    email: string;
    rol: string;
    activ: boolean;
    departament_id: number | null;
    departament: string | null;
    creat_la: string;
    proiecte: number;
    ultima_autentificare: string | null;
}

export default async function UtilizatoriPage({ searchParams }: PageProps<'/admin/utilizatori'>) {
    const user = await requirePageUser(['MANAGER']);
    const sp = await searchParams;
    const q = typeof sp.q === 'string' ? sp.q.trim() : '';
    const rol = typeof sp.rol === 'string' ? sp.rol : '';
    const editId = typeof sp.edit === 'string' ? Number(sp.edit) : null;

    const [utilizatori, departamente] = await Promise.all([
        sql`
            SELECT u.id, u.nume, u.email, u.rol, COALESCE(u.activ, TRUE) AS activ, u.departament_id,
                   d.denumire AS departament, u.creat_la,
                   (SELECT count(*) FROM asignari_proiect a WHERE a.utilizator_id = u.id)::int AS proiecte,
                   (SELECT max(creat_la) FROM jurnal_activitate j
                     WHERE j.utilizator_id = u.id AND j.actiune = 'AUTENTIFICARE') AS ultima_autentificare
            FROM utilizatori u
            LEFT JOIN departamente d ON d.id = u.departament_id
            WHERE (${rol} = '' OR u.rol = ${rol})
              AND (${q} = '' OR u.nume ILIKE '%' || ${q} || '%' OR u.email ILIKE '%' || ${q} || '%')
            ORDER BY COALESCE(u.activ, TRUE) DESC, CASE u.rol WHEN 'MANAGER' THEN 0 WHEN 'INGINER' THEN 1 ELSE 2 END, u.nume
        ` as unknown as Promise<UtilizatorRand[]>,
        sql`
            SELECT d.id, d.cod_departament, d.denumire,
                   (SELECT count(*) FROM utilizatori u WHERE u.departament_id = d.id)::int AS angajati
            FROM departamente d ORDER BY d.denumire
        ` as unknown as Promise<(Departament & { angajati: number })[]>,
    ]);

    const nr = (r: string) => utilizatori.filter((u) => u.rol === r && u.activ).length;
    const deps: Departament[] = departamente.map(({ id, cod_departament, denumire }) => ({ id, cod_departament, denumire }));

    return (
        <AppShell user={user}>
            <PageHeader
                eticheta="Administrare / Conturi"
                titlu="Utilizatori & departamente"
                subtitlu="Conturile angajatilor, rolurile de acces (MANAGER, INGINER, OPERATOR) si structura pe departamente."
                actiuni={<UtilizatorModal departamente={deps} />}
            />

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard index={0} label="Conturi" valoare={utilizatori.length} detaliu={`${utilizatori.filter((u) => !u.activ).length} inactive`} />
                <StatCard index={1} ton="mov" label="Manageri" valoare={nr('MANAGER')} detaliu="Acces complet" />
                <StatCard index={2} ton="albastru" label="Ingineri" valoare={nr('INGINER')} detaliu="BOM, scheme, testare" />
                <StatCard index={3} ton="verde" label="Operatori" valoare={nr('OPERATOR')} detaliu="Montaj & bifare" />
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
                <Card className="anim-fade-up p-0! overflow-hidden" style={delay(4, 60)}>
                    <form method="GET" className="flex flex-col sm:flex-row gap-2 p-4 border-b border-[#EEEEEE]/10">
                        <input type="search" name="q" defaultValue={q} placeholder="Cauta nume sau email..." className={`${inputCls} sm:max-w-xs`} />
                        <select name="rol" defaultValue={rol} className={`${inputCls} sm:max-w-[160px]`} aria-label="Rol">
                            <option value="">Toate rolurile</option>
                            {ROLURI.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                        <button className={btnPrimar}>Filtreaza</button>
                        {(q || rol) && (
                            <Link href="/admin/utilizatori" className={btnSecundar}>
                                Reset
                            </Link>
                        )}
                    </form>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-[#222831]/60">
                                <tr className="text-left text-[10px] uppercase tracking-wider text-[#EEEEEE]/50">
                                    <th className="px-4 py-3 font-medium">Angajat</th>
                                    <th className="px-4 py-3 font-medium">Rol</th>
                                    <th className="px-4 py-3 font-medium">Departament</th>
                                    <th className="px-4 py-3 font-medium">Proiecte</th>
                                    <th className="px-4 py-3 font-medium">Ultima autentificare</th>
                                    <th className="px-4 py-3 font-medium text-right">Actiuni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EEEEEE]/5">
                                {utilizatori.map((u, i) => (
                                    <tr key={u.id} style={delay(i, 30)} className={`anim-fade-in hover:bg-[#222831]/40 transition-colors ${u.activ ? '' : 'opacity-60'}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar nume={u.nume} marime="sm" inactiv={!u.activ} />
                                                <div className="min-w-0">
                                                    <Link href={`/admin/echipa/${u.id}`} className="font-semibold hover:text-[#FFD369] transition-colors">
                                                        {u.nume}
                                                    </Link>
                                                    {u.id === user.id && <span className="ml-1.5 text-[10px] text-[#FFD369]">(tu)</span>}
                                                    <div className="text-[10px] text-[#EEEEEE]/50">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <RolBadge rol={u.rol} />
                                            {!u.activ && <span className="block mt-1 text-[10px] text-red-300">inactiv</span>}
                                        </td>
                                        <td className="px-4 py-3 text-[#EEEEEE]/70">{u.departament ?? '-'}</td>
                                        <td className="px-4 py-3 font-mono">{u.proiecte}</td>
                                        <td className="px-4 py-3 text-[#EEEEEE]/60">
                                            {u.ultima_autentificare ? formatRelativ(u.ultima_autentificare) : 'niciodata'}
                                            <span className="block text-[10px] text-[#EEEEEE]/40">cont din {formatData(u.creat_la)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <UtilizatorModal
                                                    utilizator={{
                                                        id: u.id,
                                                        nume: u.nume,
                                                        email: u.email,
                                                        rol: u.rol,
                                                        departament_id: u.departament_id,
                                                        activ: u.activ,
                                                    }}
                                                    departamente={deps}
                                                    deschisInitial={editId === u.id}
                                                    esteContulMeu={u.id === user.id}
                                                />
                                                {u.id !== user.id && <StergeUtilizatorForm id={u.id} nume={u.nume} />}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card className="anim-slide-in xl:sticky xl:top-36">
                    <SectionTitle titlu="Departamente" descriere="Editeaza direct in lista; numarul din dreapta = angajati" />
                    <div className="space-y-2">
                        {departamente.map((d) => (
                            <DepartamentRand key={d.id} departament={d} angajati={d.angajati} />
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-[#EEEEEE]/10">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-[#EEEEEE]/50 mb-2">Departament nou</p>
                        <DepartamentNouForm />
                    </div>
                </Card>
            </div>
        </AppShell>
    );
}
