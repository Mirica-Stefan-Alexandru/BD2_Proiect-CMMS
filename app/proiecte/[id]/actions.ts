'use server';

import sql from '@/lib/db';
import { cerePermisiuneProiect } from '@/lib/session';
import { dinLista, EroareActiune, executa, intreg, logActivitate, text, type Rezultat } from '@/lib/actiuni';
import { STATUSURI_PROIECT, STATUSURI_TEST, LABEL_STATUS } from '@/lib/roluri';
import { curataSvgServer, MARIME_MAXIMA_SVG } from '@/lib/svg';
import type { RandBom } from '@/lib/csv';

async function proiectulComponentei(componentaId: number) {
    const rows = (await sql`
        SELECT proiect_id, cod_reper, verificat, verificat_de FROM componente_proiect WHERE id = ${componentaId}
    `) as { proiect_id: number; cod_reper: string; verificat: boolean; verificat_de: number | null }[];
    if (!rows[0]) throw new EroareActiune('Componenta nu mai exista.');
    return rows[0];
}

// =============================================================================
// STATUS PROIECT
// =============================================================================

export async function schimbaStatus(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const proiectId = intreg(fd, 'proiect_id');
        const user = await cerePermisiuneProiect(proiectId, 'poateEdita');
        const status = dinLista(fd, 'status', STATUSURI_PROIECT);

        const rows = (await sql`
            WITH vechi AS (SELECT status FROM proiecte WHERE id = ${proiectId})
            UPDATE proiecte SET
                status = ${status},
                finalizat_la = CASE WHEN ${status} = 'FINALIZAT' THEN COALESCE(finalizat_la, NOW()) ELSE NULL END
            WHERE id = ${proiectId}
            RETURNING (SELECT status FROM vechi) AS vechi
        `) as { vechi: string }[];
        if (!rows[0]) throw new EroareActiune('Proiectul nu mai exista.');
        if (rows[0].vechi === status) return 'Statusul nu s-a schimbat.';

        await logActivitate(user.id, proiectId, 'STATUS_SCHIMBAT', `${rows[0].vechi} -> ${status}`);
        return `Status actualizat: ${LABEL_STATUS[status]}.`;
    });
}

// =============================================================================
// BOM - CHECKLIST (bifare cu inregistrarea utilizatorului si a orei)
// =============================================================================

export async function comutaComponenta(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const id = intreg(fd, 'id');
        const comp = await proiectulComponentei(id);
        const user = await cerePermisiuneProiect(comp.proiect_id, 'poateBifa');

        if (comp.verificat && comp.verificat_de !== user.id && user.rol === 'OPERATOR') {
            throw new EroareActiune('Doar cel care a bifat componenta, un inginer sau managerul o pot debifa.');
        }

        const rows = (await sql`
            UPDATE componente_proiect SET
                verificat    = NOT COALESCE(verificat, FALSE),
                verificat_de = CASE WHEN COALESCE(verificat, FALSE) THEN NULL ELSE ${user.id}::int END,
                verificat_la = CASE WHEN COALESCE(verificat, FALSE) THEN NULL ELSE NOW() END
            WHERE id = ${id}
            RETURNING verificat
        `) as { verificat: boolean }[];

        const bifat = rows[0].verificat;
        await logActivitate(user.id, comp.proiect_id, bifat ? 'COMPONENTA_VERIFICATA' : 'COMPONENTA_DEBIFATA', comp.cod_reper);
        return bifat ? `${comp.cod_reper} marcat ca verificat de ${user.nume}.` : `${comp.cod_reper} a fost debifat.`;
    });
}

function campuriComponenta(fd: FormData) {
    const cod = text(fd, 'cod_reper', { max: 60 });
    const descriere = text(fd, 'descriere', { max: 1000 });
    const producator = text(fd, 'producator', { obligatoriu: false, max: 120 }) || null;
    const cantitate = intreg(fd, 'cantitate', { min: 1, max: 100000 });
    const observatii = text(fd, 'observatii', { obligatoriu: false, max: 1000 }) || null;
    return { cod, descriere, producator, cantitate, observatii };
}

export async function adaugaComponenta(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const proiectId = intreg(fd, 'proiect_id');
        const user = await cerePermisiuneProiect(proiectId, 'poateEdita');
        const c = campuriComponenta(fd);
        await sql`
            INSERT INTO componente_proiect (proiect_id, cod_reper, descriere, producator, cantitate, observatii)
            VALUES (${proiectId}, ${c.cod}, ${c.descriere}, ${c.producator}, ${c.cantitate}, ${c.observatii})
        `;
        await logActivitate(user.id, proiectId, 'COMPONENTA_ADAUGATA', c.cod);
        return `Componenta ${c.cod} a fost adaugata.`;
    });
}

export async function modificaComponenta(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const id = intreg(fd, 'id');
        const comp = await proiectulComponentei(id);
        const user = await cerePermisiuneProiect(comp.proiect_id, 'poateEdita');
        const c = campuriComponenta(fd);
        await sql`
            UPDATE componente_proiect SET
                cod_reper = ${c.cod}, descriere = ${c.descriere}, producator = ${c.producator},
                cantitate = ${c.cantitate}, observatii = ${c.observatii}
            WHERE id = ${id}
        `;
        await logActivitate(user.id, comp.proiect_id, 'COMPONENTA_MODIFICATA', c.cod);
        return `Componenta ${c.cod} a fost actualizata.`;
    });
}

export async function stergeComponenta(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const id = intreg(fd, 'id');
        const comp = await proiectulComponentei(id);
        const user = await cerePermisiuneProiect(comp.proiect_id, 'poateEdita');
        await sql`DELETE FROM componente_proiect WHERE id = ${id}`;
        await logActivitate(user.id, comp.proiect_id, 'COMPONENTA_STEARSA', comp.cod_reper);
        return `Componenta ${comp.cod_reper} a fost stearsa.`;
    });
}

/**
 * Import BOM (Parts list EPLAN). Toate randurile intra intr-o singura interogare
 * (INSERT ... SELECT FROM unnest(...)), deci sute de piese se salveaza intr-un round-trip.
 *  - "actualizeaza": UPSERT pe (proiect_id, cod_reper); statusul de verificare ramane
 *  - "inlocuieste": sterge BOM-ul existent si il recreeaza (tranzactie)
 */
export async function importaBom(proiectId: number, randuri: RandBom[], mod: 'actualizeaza' | 'inlocuieste'): Promise<Rezultat> {
    return executa(async () => {
        if (!Number.isInteger(proiectId) || proiectId <= 0) throw new EroareActiune('Proiect invalid.');
        const user = await cerePermisiuneProiect(proiectId, 'poateEdita');
        if (mod !== 'actualizeaza' && mod !== 'inlocuieste') throw new EroareActiune('Mod de import invalid.');
        if (!Array.isArray(randuri) || randuri.length === 0) throw new EroareActiune('Nu exista randuri de importat.');
        if (randuri.length > 5000) throw new EroareActiune('Maxim 5000 de componente per import.');

        // re-validare pe server (datele vin de la client)
        const unice = new Map<string, RandBom>();
        for (const r of randuri) {
            const cod = typeof r?.cod_reper === 'string' ? r.cod_reper.trim() : '';
            const descriere = typeof r?.descriere === 'string' ? r.descriere.trim() : '';
            const cantitate = Number(r?.cantitate);
            if (!cod || cod.length > 60 || !descriere) throw new EroareActiune(`Rand invalid: "${cod || '?'}".`);
            if (!Number.isInteger(cantitate) || cantitate <= 0 || cantitate > 100000) throw new EroareActiune(`Cantitate invalida la ${cod}.`);
            unice.set(cod, {
                cod_reper: cod,
                descriere: descriere.slice(0, 1000),
                producator: typeof r.producator === 'string' ? r.producator.trim().slice(0, 120) : '',
                cantitate,
                observatii: typeof r.observatii === 'string' ? r.observatii.trim().slice(0, 1000) : '',
            });
        }
        const lista = [...unice.values()];
        const coduri = lista.map((r) => r.cod_reper);
        const descrieri = lista.map((r) => r.descriere);
        const producatori = lista.map((r) => r.producator);
        const cantitati = lista.map((r) => r.cantitate);
        const observatii = lista.map((r) => r.observatii);

        const start = performance.now();
        const insert = sql`
            INSERT INTO componente_proiect (proiect_id, cod_reper, descriere, producator, cantitate, observatii)
            SELECT ${proiectId}, t.cod, t.descr, NULLIF(t.prod, ''), t.cant, NULLIF(t.obs, '')
            FROM unnest(${coduri}::text[], ${descrieri}::text[], ${producatori}::text[], ${cantitati}::int[], ${observatii}::text[])
                 AS t(cod, descr, prod, cant, obs)
            ON CONFLICT (proiect_id, cod_reper) DO UPDATE SET
                descriere  = EXCLUDED.descriere,
                producator = EXCLUDED.producator,
                cantitate  = EXCLUDED.cantitate,
                observatii = COALESCE(EXCLUDED.observatii, componente_proiect.observatii)
            RETURNING (xmax = 0) AS inserat
        `;

        let rezultat: { inserat: boolean }[];
        if (mod === 'inlocuieste') {
            const [, rows] = await sql.transaction([sql`DELETE FROM componente_proiect WHERE proiect_id = ${proiectId}`, insert]);
            rezultat = rows as { inserat: boolean }[];
        } else {
            rezultat = (await insert) as { inserat: boolean }[];
        }
        const ms = Math.round(performance.now() - start);

        const noi = rezultat.filter((r) => r.inserat).length;
        const actualizate = rezultat.length - noi;
        await logActivitate(user.id, proiectId, 'BOM_IMPORTAT', `${rezultat.length} componente (${noi} noi, ${actualizate} actualizate) - ${mod}`);
        return `Import finalizat in ${ms} ms: ${noi} componente noi, ${actualizate} actualizate.`;
    });
}

// =============================================================================
// PLANSE SVG (export EPLAN)
// =============================================================================

export async function incarcaPlansa(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const proiectId = intreg(fd, 'proiect_id');
        const user = await cerePermisiuneProiect(proiectId, 'poateEdita');
        const numarPagina = intreg(fd, 'numar_pagina', { min: 1, max: 9999 });
        const titlu = text(fd, 'titlu_pagina', { max: 200 });

        const fisier = fd.get('fisier');
        if (!(fisier instanceof File) || fisier.size === 0) throw new EroareActiune('Alege fisierul SVG exportat din EPLAN.');
        if (fisier.size > MARIME_MAXIMA_SVG) throw new EroareActiune('Fisierul depaseste 8 MB.');
        if (!/\.svg$/i.test(fisier.name) && fisier.type !== 'image/svg+xml') throw new EroareActiune('Sunt acceptate doar fisiere .svg.');

        let svg: string;
        try {
            svg = curataSvgServer(await fisier.text());
        } catch {
            throw new EroareActiune('Fisierul nu este un SVG valid.');
        }
        const numeFisier = fisier.name.replace(/[^\w.\- ]/g, '_').slice(0, 200);

        await sql`
            INSERT INTO planse_schema (proiect_id, numar_pagina, titlu_pagina, cale_fisier, continut_svg)
            VALUES (${proiectId}, ${numarPagina}, ${titlu}, ${numeFisier}, ${svg})
            ON CONFLICT (proiect_id, numar_pagina) DO UPDATE SET
                titlu_pagina = EXCLUDED.titlu_pagina,
                cale_fisier  = EXCLUDED.cale_fisier,
                continut_svg = EXCLUDED.continut_svg
        `;
        await logActivitate(user.id, proiectId, 'PLANSA_INCARCATA', `Pagina ${numarPagina}: ${titlu}`);
        return `Plansa ${numarPagina} a fost incarcata. Reperele sunt detectate automat in desen.`;
    });
}

export async function stergePlansa(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const id = intreg(fd, 'id');
        const rows = (await sql`SELECT proiect_id, numar_pagina FROM planse_schema WHERE id = ${id}`) as {
            proiect_id: number;
            numar_pagina: number;
        }[];
        if (!rows[0]) throw new EroareActiune('Plansa nu mai exista.');
        const user = await cerePermisiuneProiect(rows[0].proiect_id, 'poateEdita');
        await sql`DELETE FROM planse_schema WHERE id = ${id}`;
        await logActivitate(user.id, rows[0].proiect_id, 'PLANSA_STEARSA', `Pagina ${rows[0].numar_pagina}`);
        return `Plansa ${rows[0].numar_pagina} a fost stearsa.`;
    });
}

// =============================================================================
// TESTARE LA RECE (semnatura electronica a inginerului)
// =============================================================================

function procent(fd: FormData, camp: string, min: number): number | null {
    const v = fd.get(camp);
    if (v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new EroareActiune('Pozitie invalida.');
    return Math.min(100, Math.max(min, Math.round(n * 100) / 100));
}

export async function inregistreazaTest(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const status = dinLista(fd, 'status_test', STATUSURI_TEST);
        const observatii = text(fd, 'observatii', { obligatoriu: false, max: 1000 }) || null;
        if ((status === 'ROSU' || status === 'NEGRU') && !observatii) {
            throw new EroareActiune('Pentru un test neconform descrie defectul in observatii.');
        }

        let componentaId: number;
        let proiectId: number;
        let tag: string;

        const idExistent = String(fd.get('componenta_id') ?? '');
        if (idExistent) {
            const rows = (await sql`
                SELECT cs.id, cs.tag_echipament, ps.proiect_id
                FROM componente_schema cs JOIN planse_schema ps ON ps.id = cs.plansa_id
                WHERE cs.id = ${intreg(fd, 'componenta_id')}
            `) as { id: number; tag_echipament: string; proiect_id: number }[];
            if (!rows[0]) throw new EroareActiune('Componenta din schema nu mai exista.');
            ({ id: componentaId, tag_echipament: tag, proiect_id: proiectId } = rows[0]);
            await cerePermisiuneProiect(proiectId, 'poateTesta');
        } else {
            // reper detectat automat in SVG: se creeaza pozitia pe plansa (fara calibrare manuala)
            const plansaId = intreg(fd, 'plansa_id');
            tag = text(fd, 'tag_echipament', { max: 60 });
            const descriere = text(fd, 'descriere_tip', { obligatoriu: false, max: 200 }) || 'Detectat automat in schema SVG';
            const x = procent(fd, 'pos_x', 0) ?? 0;
            const y = procent(fd, 'pos_y', 0) ?? 0;
            const w = procent(fd, 'latime', 0.01) ?? 1;
            const h = procent(fd, 'inaltime', 0.01) ?? 1;

            const plansa = (await sql`SELECT proiect_id FROM planse_schema WHERE id = ${plansaId}`) as { proiect_id: number }[];
            if (!plansa[0]) throw new EroareActiune('Plansa nu mai exista.');
            proiectId = plansa[0].proiect_id;
            await cerePermisiuneProiect(proiectId, 'poateTesta');

            const rows = (await sql`
                INSERT INTO componente_schema (plansa_id, tag_echipament, descriere_tip, pos_x, pos_y, latime, inaltime)
                VALUES (${plansaId}, ${tag}, ${descriere}, ${x}, ${y}, ${w}, ${h})
                ON CONFLICT (plansa_id, tag_echipament) DO UPDATE SET
                    pos_x = EXCLUDED.pos_x, pos_y = EXCLUDED.pos_y,
                    latime = EXCLUDED.latime, inaltime = EXCLUDED.inaltime
                RETURNING id
            `) as { id: number }[];
            componentaId = rows[0].id;
        }

        const user = await cerePermisiuneProiect(proiectId, 'poateTesta');
        await sql`
            INSERT INTO verificari_componente (componenta_id, verificat_de_id, status_test, observatii)
            VALUES (${componentaId}, ${user.id}, ${status}, ${observatii})
        `;
        await logActivitate(user.id, proiectId, 'TEST_INREGISTRAT', `${tag}: ${status}`);
        return `Test ${tag} semnat de ${user.nume}: ${status}.`;
    });
}
