import sql from '@/lib/db';

export interface ProiectAngajat {
    id: number;
    cod: string;
    titlu: string;
    status: string;
    rol: string;
    termen: string;
}

export interface PerformantaAngajat {
    id: number;
    nume: string;
    email: string;
    rol: string;
    activ: boolean;
    creat_la: string;
    departament: string | null;
    departament_id: number | null;
    proiecte_total: number;
    proiecte_active: number;
    proiecte_finalizate: number;
    proiecte_intarziate: number;
    finalizate_la_termen: number;
    proiecte: ProiectAngajat[];
    componente_verificate: number;
    componente_verificate_30: number;
    teste_semnate: number;
    teste_semnate_30: number;
    qc_executate: number;
    qc_conforme: number;
    ultima_activitate: string | null;
    actiuni_30: number;
    // calculate in TypeScript
    rataLivrare: number | null;
    calitate: number | null;
    productivitate: number | null;
    indice: number | null;
}

/**
 * Metrici de performanta pe angajat. O singura interogare cu subinterogari
 * LATERAL; fiecare foloseste un index dedicat (vezi db/schema.sql):
 *   asignari  -> idx_asignari_utilizator
 *   BOM       -> idx_componente_verificat_de (index partial)
 *   teste     -> idx_verificari_utilizator, idx_verificari_componenta_data
 *   jurnal    -> idx_jurnal_utilizator_data
 */
export async function getPerformanta(utilizatorId?: number): Promise<PerformantaAngajat[]> {
    const id = utilizatorId ?? null;
    const rows = (await sql`
        SELECT u.id, u.nume, u.email, u.rol, COALESCE(u.activ, TRUE) AS activ, u.creat_la,
               u.departament_id, d.denumire AS departament,
               COALESCE(pr.total, 0)::int                AS proiecte_total,
               COALESCE(pr.active, 0)::int               AS proiecte_active,
               COALESCE(pr.finalizate, 0)::int           AS proiecte_finalizate,
               COALESCE(pr.intarziate, 0)::int           AS proiecte_intarziate,
               COALESCE(pr.finalizate_la_termen, 0)::int AS finalizate_la_termen,
               COALESCE(pr.lista, '[]'::json)            AS proiecte,
               COALESCE(b.verificate, 0)::int            AS componente_verificate,
               COALESCE(b.verificate_30, 0)::int         AS componente_verificate_30,
               COALESCE(t.semnate, 0)::int               AS teste_semnate,
               COALESCE(t.semnate_30, 0)::int            AS teste_semnate_30,
               COALESCE(q.executate, 0)::int             AS qc_executate,
               COALESCE(q.conforme, 0)::int              AS qc_conforme,
               j.ultima                                  AS ultima_activitate,
               COALESCE(j.actiuni_30, 0)::int            AS actiuni_30
        FROM utilizatori u
        LEFT JOIN departamente d ON d.id = u.departament_id
        LEFT JOIN LATERAL (
            SELECT count(*) AS total,
                   count(*) FILTER (WHERE p.status <> 'FINALIZAT') AS active,
                   count(*) FILTER (WHERE p.status = 'FINALIZAT')  AS finalizate,
                   count(*) FILTER (WHERE p.status <> 'FINALIZAT' AND p.termen_limita < CURRENT_DATE) AS intarziate,
                   count(*) FILTER (WHERE p.status = 'FINALIZAT'
                                    AND (p.finalizat_la IS NULL OR p.finalizat_la::date <= p.termen_limita)) AS finalizate_la_termen,
                   json_agg(json_build_object(
                       'id', p.id, 'cod', p.cod_comanda, 'titlu', p.titlu, 'status', p.status,
                       'rol', a.rol_in_proiect, 'termen', p.termen_limita
                   ) ORDER BY (p.status = 'FINALIZAT'), p.termen_limita) AS lista
            FROM asignari_proiect a
            JOIN proiecte p ON p.id = a.proiect_id
            WHERE a.utilizator_id = u.id
        ) pr ON TRUE
        LEFT JOIN LATERAL (
            SELECT count(*) AS verificate,
                   count(*) FILTER (WHERE verificat_la > NOW() - INTERVAL '30 days') AS verificate_30
            FROM componente_proiect
            WHERE verificat_de = u.id AND verificat
        ) b ON TRUE
        LEFT JOIN LATERAL (
            SELECT count(*) FILTER (WHERE status_test <> 'NEVERIFICAT') AS semnate,
                   count(*) FILTER (WHERE status_test <> 'NEVERIFICAT'
                                    AND data_verificare > NOW() - INTERVAL '30 days') AS semnate_30
            FROM verificari_componente
            WHERE verificat_de_id = u.id
        ) t ON TRUE
        LEFT JOIN LATERAL (
            -- calitatea executiei pe proiectele angajatului: ultimul test al fiecarei componente
            SELECT count(*) FILTER (WHERE ult.status_test <> 'NEVERIFICAT') AS executate,
                   count(*) FILTER (WHERE ult.status_test = 'VERDE')        AS conforme
            FROM asignari_proiect a
            JOIN planse_schema ps     ON ps.proiect_id = a.proiect_id
            JOIN componente_schema cs ON cs.plansa_id = ps.id
            JOIN LATERAL (
                SELECT v.status_test FROM verificari_componente v
                WHERE v.componenta_id = cs.id
                ORDER BY v.data_verificare DESC
                LIMIT 1
            ) ult ON TRUE
            WHERE a.utilizator_id = u.id
        ) q ON TRUE
        LEFT JOIN LATERAL (
            SELECT max(creat_la) AS ultima,
                   count(*) FILTER (WHERE creat_la > NOW() - INTERVAL '30 days'
                                    AND actiune <> 'AUTENTIFICARE') AS actiuni_30
            FROM jurnal_activitate
            WHERE utilizator_id = u.id
        ) j ON TRUE
        WHERE ${id}::int IS NULL OR u.id = ${id}::int
        ORDER BY u.nume
    `) as Omit<PerformantaAngajat, 'rataLivrare' | 'calitate' | 'productivitate' | 'indice'>[];

    // productivitatea este relativa la cel mai activ coleg cu acelasi rol (30 zile)
    const volum = (r: (typeof rows)[number]) => r.componente_verificate_30 + r.teste_semnate_30;
    const maxPeRol: Record<string, number> = {};
    if (id === null) {
        for (const r of rows) maxPeRol[r.rol] = Math.max(maxPeRol[r.rol] ?? 0, volum(r));
    } else {
        const toti = (await sql`
            SELECT u.rol,
                   max((SELECT count(*) FROM componente_proiect c
                        WHERE c.verificat_de = u.id AND c.verificat AND c.verificat_la > NOW() - INTERVAL '30 days')
                     + (SELECT count(*) FROM verificari_componente v
                        WHERE v.verificat_de_id = u.id AND v.status_test <> 'NEVERIFICAT'
                          AND v.data_verificare > NOW() - INTERVAL '30 days'))::int AS max_volum
            FROM utilizatori u GROUP BY u.rol
        `) as { rol: string; max_volum: number }[];
        for (const r of toti) maxPeRol[r.rol] = r.max_volum;
    }

    return rows.map((r) => {
        const evaluate = r.proiecte_finalizate + r.proiecte_active;
        const laTermen = r.finalizate_la_termen + (r.proiecte_active - r.proiecte_intarziate);
        const rataLivrare = evaluate > 0 ? Math.round((laTermen / evaluate) * 100) : null;
        const calitate = r.qc_executate > 0 ? Math.round((r.qc_conforme / r.qc_executate) * 100) : null;
        const max = maxPeRol[r.rol] ?? 0;
        const productivitate = r.rol === 'MANAGER' ? null : max > 0 ? Math.round((volum(r) / max) * 100) : null;

        const componente = [rataLivrare, calitate, productivitate].filter((v): v is number => v !== null);
        const indice = componente.length
            ? Math.round(componente.reduce((s, v) => s + v, 0) / componente.length)
            : null;

        return { ...r, rataLivrare, calitate, productivitate, indice };
    });
}

export function culoareIndice(v: number | null): { text: string; bar: string; hex: string } {
    if (v === null) return { text: 'text-[#EEEEEE]/50', bar: 'bg-zinc-500', hex: '#71717a' };
    if (v >= 80) return { text: 'text-emerald-300', bar: 'bg-emerald-400', hex: '#34d399' };
    if (v >= 55) return { text: 'text-amber-300', bar: 'bg-amber-400', hex: '#fbbf24' };
    return { text: 'text-red-300', bar: 'bg-red-400', hex: '#f87171' };
}

export const EXPLICATIE_INDICE =
    'Indice = media componentelor disponibile: livrare la termen (proiecte nedepasite sau finalizate la timp), ' +
    'calitate QC (procent componente cu ultimul test VERDE pe proiectele angajatului) si productivitate ' +
    '(componente bifate + teste semnate in ultimele 30 de zile, raportat la cel mai activ coleg cu acelasi rol).';
