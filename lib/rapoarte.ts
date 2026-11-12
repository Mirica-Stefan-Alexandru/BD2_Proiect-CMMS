import sql from '@/lib/db';
import { getPerformanta } from '@/lib/performanta';
import type { SessionUser } from '@/lib/session';
import { LABEL_STATUS, LABEL_TEST, ROLURI_IN_PROIECT } from '@/lib/roluri';
import { formatData, formatDataOra } from '@/lib/ui';

export const TIPURI_RAPORT = {
    proiecte: { titlu: 'Situatie proiecte', descriere: 'Toate comenzile cu status, termen, echipa si progresul BOM.', doarManager: false, cuProiect: false },
    bom: { titlu: 'Lista materiale (BOM)', descriere: 'Componentele cu statusul de verificare si cine le-a bifat.', doarManager: false, cuProiect: true },
    verificari: { titlu: 'Testare la rece', descriere: 'Istoricul complet al testelor semnate (view v_verificari_complete).', doarManager: false, cuProiect: true },
    performanta: { titlu: 'Performanta echipa', descriere: 'Metrici pe angajat: proiecte, verificari, calitate, indice.', doarManager: true, cuProiect: false },
    jurnal: { titlu: 'Jurnal activitate', descriere: 'Ultimele 5000 de actiuni din sistem (audit).', doarManager: true, cuProiect: false },
} as const;

export type TipRaport = keyof typeof TIPURI_RAPORT;

export interface DateRaport {
    titlu: string;
    header: string[];
    randuri: (string | number | boolean | null)[][];
}

/**
 * Construieste datele unui raport. Inginerii vad doar proiectele pe care sunt asignati;
 * managerul vede tot. proiectId optional filtreaza pe un singur proiect.
 */
export async function construiesteRaport(tip: TipRaport, user: SessionUser, proiectId: number | null): Promise<DateRaport> {
    const toate = user.rol === 'MANAGER';
    const uid = user.id;
    const pid = proiectId;

    switch (tip) {
        case 'proiecte': {
            const rows = (await sql`
                SELECT p.cod_comanda, p.titlu, p.status, p.termen_limita, p.finalizat_la, u.nume AS creat_de,
                       (SELECT string_agg(x.nume || ' (' || a.rol_in_proiect || ')', ', ' ORDER BY x.nume)
                        FROM asignari_proiect a JOIN utilizatori x ON x.id = a.utilizator_id WHERE a.proiect_id = p.id) AS echipa,
                       (SELECT count(*) FROM componente_proiect c WHERE c.proiect_id = p.id)::int AS componente,
                       (SELECT count(*) FROM componente_proiect c WHERE c.proiect_id = p.id AND c.verificat)::int AS verificate
                FROM proiecte p LEFT JOIN utilizatori u ON u.id = p.creat_de_id
                WHERE (${toate} OR EXISTS (SELECT 1 FROM asignari_proiect a WHERE a.proiect_id = p.id AND a.utilizator_id = ${uid}))
                  AND (${pid}::int IS NULL OR p.id = ${pid}::int)
                ORDER BY p.termen_limita
            `) as Record<string, unknown>[];
            return {
                titlu: 'Situatie proiecte',
                header: ['Cod comanda', 'Titlu', 'Status', 'Termen limita', 'Finalizat la', 'Creat de', 'Echipa', 'Componente', 'Verificate', 'Progres %'],
                randuri: rows.map((r) => [
                    r.cod_comanda as string,
                    r.titlu as string,
                    LABEL_STATUS[r.status as string] ?? (r.status as string),
                    formatData(r.termen_limita as string),
                    r.finalizat_la ? formatData(r.finalizat_la as string) : '',
                    (r.creat_de as string) ?? '',
                    (r.echipa as string) ?? '',
                    r.componente as number,
                    r.verificate as number,
                    (r.componente as number) ? Math.round(((r.verificate as number) / (r.componente as number)) * 100) : 0,
                ]),
            };
        }
        case 'bom': {
            const rows = (await sql`
                SELECT p.cod_comanda, c.cod_reper, c.descriere, c.producator, c.cantitate, COALESCE(c.verificat, FALSE) AS verificat,
                       u.nume AS verificat_de, c.verificat_la, c.observatii
                FROM componente_proiect c
                JOIN proiecte p ON p.id = c.proiect_id
                LEFT JOIN utilizatori u ON u.id = c.verificat_de
                WHERE (${toate} OR EXISTS (SELECT 1 FROM asignari_proiect a WHERE a.proiect_id = p.id AND a.utilizator_id = ${uid}))
                  AND (${pid}::int IS NULL OR p.id = ${pid}::int)
                ORDER BY p.cod_comanda, c.cod_reper
            `) as Record<string, unknown>[];
            return {
                titlu: 'Lista materiale BOM',
                header: ['Proiect', 'Cod reper', 'Descriere', 'Producator', 'Cantitate', 'Verificat', 'Verificat de', 'Data verificare', 'Observatii'],
                randuri: rows.map((r) => [
                    r.cod_comanda as string,
                    r.cod_reper as string,
                    r.descriere as string,
                    (r.producator as string) ?? '',
                    (r.cantitate as number) ?? 1,
                    r.verificat as boolean,
                    (r.verificat_de as string) ?? '',
                    r.verificat_la ? formatDataOra(r.verificat_la as string) : '',
                    (r.observatii as string) ?? '',
                ]),
            };
        }
        case 'verificari': {
            const rows = (await sql`
                SELECT v.cod_comanda, v.numar_pagina, v.tag_echipament, v.status_test, v.observatii, v.data_verificare, v.verificat_de
                FROM v_verificari_complete v
                WHERE (${toate} OR EXISTS (SELECT 1 FROM asignari_proiect a WHERE a.proiect_id = v.proiect_id AND a.utilizator_id = ${uid}))
                  AND (${pid}::int IS NULL OR v.proiect_id = ${pid}::int)
                ORDER BY v.data_verificare DESC
            `) as Record<string, unknown>[];
            return {
                titlu: 'Testare la rece',
                header: ['Proiect', 'Pagina', 'Reper', 'Rezultat', 'Cod status', 'Observatii', 'Data', 'Semnat de'],
                randuri: rows.map((r) => [
                    r.cod_comanda as string,
                    r.numar_pagina as number,
                    r.tag_echipament as string,
                    LABEL_TEST[r.status_test as string] ?? '',
                    r.status_test as string,
                    (r.observatii as string) ?? '',
                    formatDataOra(r.data_verificare as string),
                    (r.verificat_de as string) ?? '',
                ]),
            };
        }
        case 'performanta': {
            const rows = await getPerformanta();
            return {
                titlu: 'Performanta echipa',
                header: [
                    'Angajat', 'Email', 'Rol', 'Departament', 'Activ', 'Proiecte active', 'Proiecte finalizate', 'Proiecte depasite',
                    'Componente bifate', 'Bifate 30 zile', 'Teste semnate', 'Teste 30 zile', 'Calitate QC %', 'Livrare la termen %',
                    'Productivitate %', 'Indice performanta', 'Proiecte',
                ],
                randuri: rows.map((r) => [
                    r.nume, r.email, r.rol, r.departament ?? '', r.activ, r.proiecte_active, r.proiecte_finalizate, r.proiecte_intarziate,
                    r.componente_verificate, r.componente_verificate_30, r.teste_semnate, r.teste_semnate_30, r.calitate, r.rataLivrare,
                    r.productivitate, r.indice,
                    r.proiecte.map((p) => `${p.cod} (${ROLURI_IN_PROIECT[p.rol]?.label ?? p.rol})`).join(', '),
                ]),
            };
        }
        case 'jurnal': {
            const rows = (await sql`
                SELECT j.creat_la, u.nume, j.actiune, p.cod_comanda, j.detalii
                FROM jurnal_activitate j
                LEFT JOIN utilizatori u ON u.id = j.utilizator_id
                LEFT JOIN proiecte p ON p.id = j.proiect_id
                WHERE (${pid}::int IS NULL OR j.proiect_id = ${pid}::int)
                ORDER BY j.creat_la DESC
                LIMIT 5000
            `) as Record<string, unknown>[];
            return {
                titlu: 'Jurnal activitate',
                header: ['Data', 'Utilizator', 'Actiune', 'Proiect', 'Detalii'],
                randuri: rows.map((r) => [
                    formatDataOra(r.creat_la as string),
                    (r.nume as string) ?? 'Sistem',
                    r.actiune as string,
                    (r.cod_comanda as string) ?? '',
                    (r.detalii as string) ?? '',
                ]),
            };
        }
    }
}
