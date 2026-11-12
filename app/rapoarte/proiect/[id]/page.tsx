import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import sql from '@/lib/db';
import { accesProiect, requirePageUser } from '@/lib/session';
import PrintButton from '@/components/PrintButton';
import { btnSecundar } from '@/components/ui';
import { calculeazaProgres, formatData, formatDataOra } from '@/lib/ui';
import { LABEL_STATUS, LABEL_TEST, ROLURI_IN_PROIECT } from '@/lib/roluri';

export const instant = false;
export const metadata: Metadata = { title: 'Fisa de receptie' };

const CULOARE_TEST: Record<string, string> = {
    VERDE: '#047857',
    GALBEN: '#b45309',
    ROSU: '#b91c1c',
    NEGRU: '#111827',
    NEVERIFICAT: '#6b7280',
};

export default async function RaportProiectPage({ params }: PageProps<'/rapoarte/proiect/[id]'>) {
    const user = await requirePageUser(['MANAGER', 'INGINER']);
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();
    if (!(await accesProiect(user, id)).poateVedea) redirect('/rapoarte');

    const [proiect] = (await sql`
        SELECT p.*, u.nume AS creat_de FROM proiecte p LEFT JOIN utilizatori u ON u.id = p.creat_de_id WHERE p.id = ${id}
    `) as {
        cod_comanda: string; titlu: string; descriere: string | null; status: string;
        termen_limita: string; creat_la: string; finalizat_la: string | null; creat_de: string | null;
    }[];
    if (!proiect) notFound();

    const [echipa, bom, teste] = await Promise.all([
        sql`
            SELECT u.nume, u.rol, a.rol_in_proiect FROM asignari_proiect a JOIN utilizatori u ON u.id = a.utilizator_id
            WHERE a.proiect_id = ${id} ORDER BY u.nume
        ` as unknown as Promise<{ nume: string; rol: string; rol_in_proiect: string }[]>,
        sql`
            SELECT c.cod_reper, c.descriere, c.producator, c.cantitate, COALESCE(c.verificat, FALSE) AS verificat,
                   u.nume AS verificat_de, c.verificat_la
            FROM componente_proiect c LEFT JOIN utilizatori u ON u.id = c.verificat_de
            WHERE c.proiect_id = ${id} ORDER BY c.cod_reper
        ` as unknown as Promise<{ cod_reper: string; descriere: string; producator: string | null; cantitate: number | null; verificat: boolean; verificat_de: string | null; verificat_la: string | null }[]>,
        sql`
            SELECT DISTINCT ON (v.tag_echipament, v.numar_pagina)
                   v.numar_pagina, v.tag_echipament, v.status_test, v.observatii, v.data_verificare, v.verificat_de
            FROM v_verificari_complete v WHERE v.proiect_id = ${id}
            ORDER BY v.tag_echipament, v.numar_pagina, v.data_verificare DESC
        ` as unknown as Promise<{ numar_pagina: number; tag_echipament: string; status_test: string; observatii: string | null; data_verificare: string; verificat_de: string | null }[]>,
    ]);

    const verificate = bom.filter((c) => c.verificat).length;
    const progres = calculeazaProgres(proiect.status, bom.length, verificate);
    const conforme = teste.filter((t) => t.status_test === 'VERDE').length;
    const generatLa = formatDataOra(new Date());

    const th = 'text-left text-[9px] uppercase tracking-wider text-zinc-500 font-semibold border-b border-zinc-300 px-2 py-1.5';
    const td = 'px-2 py-1.5 border-b border-zinc-200 align-top';

    return (
        <div className="min-h-screen bg-[#222831] print:bg-white">
            <div className="no-print sticky top-0 z-10 bg-[#222831]/90 backdrop-blur border-b border-[#393E46]">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                    <Link href={`/proiecte/${id}`} className={btnSecundar}>
                        &larr; Inapoi la proiect
                    </Link>
                    <span className="hidden sm:block text-xs text-[#EEEEEE]/60">Din dialogul de printare alege &quot;Salveaza ca PDF&quot;.</span>
                    <PrintButton />
                </div>
            </div>

            <article className="print-page anim-fade-up max-w-4xl mx-auto my-8 print:my-0 bg-white text-zinc-900 rounded-2xl print:rounded-none shadow-2xl shadow-black/50 p-10 print:p-0 text-[11px] leading-relaxed">
                <header className="flex items-start justify-between gap-6 border-b-4 border-[#FFD369] pb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-[#222831] text-[#FFD369] flex items-center justify-center text-xs font-black">CM</span>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">CMMS Industrial · Fisa de receptie</span>
                        </div>
                        <h1 className="text-2xl font-extrabold tracking-tight mt-3">{proiect.titlu}</h1>
                        <p className="font-mono text-sm text-zinc-600">{proiect.cod_comanda}</p>
                    </div>
                    <div className="text-right text-[10px] text-zinc-500 space-y-0.5 shrink-0">
                        <div>Generat: {generatLa}</div>
                        <div>De: {user.nume}</div>
                        <div className="mt-2 inline-block px-2 py-1 rounded border border-zinc-300 font-semibold text-zinc-800">{LABEL_STATUS[proiect.status]}</div>
                    </div>
                </header>

                <section className="grid grid-cols-4 gap-3 my-6">
                    {[
                        ['Termen limita', formatData(proiect.termen_limita)],
                        ['Finalizat', proiect.finalizat_la ? formatData(proiect.finalizat_la) : '-'],
                        ['Componente verificate', `${verificate}/${bom.length} (${progres}%)`],
                        ['Teste conforme', `${conforme}/${teste.length}`],
                    ].map(([l, v]) => (
                        <div key={l} className="border border-zinc-200 rounded-lg p-3">
                            <div className="text-[9px] uppercase tracking-wider text-zinc-500">{l}</div>
                            <div className="text-sm font-bold mt-0.5">{v}</div>
                        </div>
                    ))}
                </section>

                {proiect.descriere && <p className="mb-6 text-zinc-700">{proiect.descriere}</p>}

                <h2 className="text-sm font-bold mb-2">1. Echipa proiectului</h2>
                <table className="w-full mb-6 border-collapse">
                    <thead>
                        <tr>
                            <th className={th}>Nume</th>
                            <th className={th}>Rol sistem</th>
                            <th className={th}>Rol in proiect</th>
                        </tr>
                    </thead>
                    <tbody>
                        {echipa.map((m) => (
                            <tr key={m.nume}>
                                <td className={td}>{m.nume}</td>
                                <td className={td}>{m.rol}</td>
                                <td className={td}>{ROLURI_IN_PROIECT[m.rol_in_proiect]?.label ?? m.rol_in_proiect}</td>
                            </tr>
                        ))}
                        {echipa.length === 0 && (
                            <tr>
                                <td className={td} colSpan={3}>Nicio persoana asignata.</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <h2 className="text-sm font-bold mb-2">2. Lista materiale (BOM) si checklist montaj</h2>
                <table className="w-full mb-6 border-collapse">
                    <thead>
                        <tr>
                            <th className={th}>Reper</th>
                            <th className={th}>Descriere</th>
                            <th className={th}>Producator</th>
                            <th className={`${th} text-right`}>Cant.</th>
                            <th className={th}>Verificat</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bom.map((c) => (
                            <tr key={c.cod_reper} className="break-inside-avoid">
                                <td className={`${td} font-mono font-bold whitespace-nowrap`}>{c.cod_reper}</td>
                                <td className={td}>{c.descriere}</td>
                                <td className={td}>{c.producator ?? '-'}</td>
                                <td className={`${td} text-right font-mono`}>{c.cantitate ?? 1}</td>
                                <td className={`${td} whitespace-nowrap`}>
                                    {c.verificat ? (
                                        <span className="text-emerald-700 font-semibold">
                                            ✓ {c.verificat_de ?? ''}
                                            <span className="block font-normal text-[9px] text-zinc-500">{c.verificat_la ? formatDataOra(c.verificat_la) : ''}</span>
                                        </span>
                                    ) : (
                                        <span className="text-zinc-400">☐ neverificat</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {bom.length === 0 && (
                            <tr>
                                <td className={td} colSpan={5}>BOM neimportat.</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <h2 className="text-sm font-bold mb-2">3. Testare la rece (ultimul rezultat per reper)</h2>
                <table className="w-full mb-8 border-collapse">
                    <thead>
                        <tr>
                            <th className={th}>Pag.</th>
                            <th className={th}>Reper</th>
                            <th className={th}>Rezultat</th>
                            <th className={th}>Observatii</th>
                            <th className={th}>Semnat de / data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teste.map((t) => (
                            <tr key={`${t.numar_pagina}-${t.tag_echipament}`} className="break-inside-avoid">
                                <td className={`${td} font-mono`}>{t.numar_pagina}</td>
                                <td className={`${td} font-mono font-bold`}>{t.tag_echipament}</td>
                                <td className={td} style={{ color: CULOARE_TEST[t.status_test] }}>
                                    <span className="font-semibold">{LABEL_TEST[t.status_test]}</span>
                                </td>
                                <td className={td}>{t.observatii ?? '-'}</td>
                                <td className={`${td} whitespace-nowrap`}>
                                    {t.verificat_de ?? '-'}
                                    <span className="block text-[9px] text-zinc-500">{formatDataOra(t.data_verificare)}</span>
                                </td>
                            </tr>
                        ))}
                        {teste.length === 0 && (
                            <tr>
                                <td className={td} colSpan={5}>Niciun test inregistrat.</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <footer className="grid grid-cols-2 gap-10 pt-6 border-t border-zinc-300 break-inside-avoid">
                    {['Responsabil testare', 'Manager proiect'].map((r) => (
                        <div key={r}>
                            <div className="text-[9px] uppercase tracking-wider text-zinc-500">{r}</div>
                            <div className="h-12 border-b border-zinc-400 mt-6" />
                            <div className="text-[9px] text-zinc-500 mt-1">Nume, semnatura, data</div>
                        </div>
                    ))}
                </footer>
            </article>
        </div>
    );
}
