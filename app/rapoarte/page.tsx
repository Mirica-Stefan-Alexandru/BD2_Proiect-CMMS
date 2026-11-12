import type { Metadata } from 'next';
import Link from 'next/link';
import sql from '@/lib/db';
import { requirePageUser } from '@/lib/session';
import AppShell from '@/components/AppShell';
import { btnPrimar, btnSecundar, Card, CodBadge, delay, inputCls, PageHeader, SectionTitle, StatusBadge } from '@/components/ui';
import { TIPURI_RAPORT, type TipRaport } from '@/lib/rapoarte';
import { formatData } from '@/lib/ui';

export const instant = false;
export const metadata: Metadata = { title: 'Rapoarte' };

const ICONITE: Record<TipRaport, string> = {
    proiecte: 'M3 7h18M3 12h18M3 17h12',
    bom: 'M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01',
    verificari: 'M9 12l2 2 4-4M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z',
    performanta: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
    jurnal: 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
};

export default async function RapoartePage() {
    const user = await requirePageUser(['MANAGER', 'INGINER']);
    const esteManager = user.rol === 'MANAGER';

    const proiecte = (await sql`
        SELECT p.id, p.cod_comanda, p.titlu, p.status, p.termen_limita
        FROM proiecte p
        WHERE ${esteManager} OR EXISTS (SELECT 1 FROM asignari_proiect a WHERE a.proiect_id = p.id AND a.utilizator_id = ${user.id})
        ORDER BY (p.status = 'FINALIZAT'), p.termen_limita
    `) as { id: number; cod_comanda: string; titlu: string; status: string; termen_limita: string }[];

    const tipuri = (Object.entries(TIPURI_RAPORT) as [TipRaport, (typeof TIPURI_RAPORT)[TipRaport]][]).filter(
        ([, t]) => esteManager || !t.doarManager
    );

    return (
        <AppShell user={user}>
            <PageHeader
                eticheta="Rapoarte"
                titlu="Rapoarte & exporturi"
                subtitlu={
                    esteManager
                        ? 'Rapoarte generate direct din baza de date, in format Excel (.xlsx), CSV sau PDF (fisa de receptie a proiectului).'
                        : 'Rapoartele includ doar proiectele pe care esti asignat.'
                }
            />

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {tipuri.map(([cheie, t], i) => (
                    <Card key={cheie} style={delay(i, 60)} className="anim-fade-up card-glow flex flex-col gap-4 transition-transform duration-300 hover:-translate-y-0.5">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#222831] border border-[#FFD369]/30 flex items-center justify-center text-[#FFD369] shrink-0">
                                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d={ICONITE[cheie]} />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold">{t.titlu}</h2>
                                <p className="text-xs text-[#EEEEEE]/60 mt-0.5">{t.descriere}</p>
                            </div>
                        </div>
                        <form method="GET" action="/api/rapoarte" className="mt-auto space-y-2">
                            <input type="hidden" name="tip" value={cheie} />
                            {t.cuProiect && (
                                <select name="proiect" className={inputCls} aria-label="Proiect" defaultValue="">
                                    <option value="">Toate proiectele</option>
                                    {proiecte.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.cod_comanda} - {p.titlu}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <div className="flex gap-2">
                                <button name="format" value="xlsx" className={`${btnPrimar} flex-1`}>
                                    Excel (.xlsx)
                                </button>
                                <button name="format" value="csv" className={`${btnSecundar} flex-1`}>
                                    CSV
                                </button>
                            </div>
                        </form>
                    </Card>
                ))}
            </section>

            <Card className="anim-fade-up" style={delay(tipuri.length, 60)}>
                <SectionTitle
                    titlu="Fisa de receptie proiect (PDF)"
                    descriere="Raport printabil cu echipa, BOM-ul verificat si testele la rece semnate. Se deschide in browser si se salveaza ca PDF."
                />
                {proiecte.length === 0 ? (
                    <p className="text-xs text-[#EEEEEE]/50">Nu exista proiecte disponibile.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {proiecte.map((p) => (
                            <Link
                                key={p.id}
                                href={`/rapoarte/proiect/${p.id}`}
                                className="group flex items-center justify-between gap-3 bg-[#222831]/50 border border-[#EEEEEE]/10 hover:border-[#FFD369]/50 rounded-xl px-3 py-2.5 transition-all"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <CodBadge>{p.cod_comanda}</CodBadge>
                                    <span className="text-xs truncate group-hover:text-[#FFD369] transition-colors">{p.titlu}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="hidden sm:inline text-[10px] text-[#EEEEEE]/40">{formatData(p.termen_limita)}</span>
                                    <StatusBadge status={p.status} />
                                    <span className="text-[#FFD369] transition-transform group-hover:translate-x-0.5">&rarr;</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </Card>
        </AppShell>
    );
}
