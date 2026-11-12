'use server';

import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { requireActionUser } from '@/lib/session';
import { data, dinLista, EroareActiune, executa, intreg, logActivitate, text, type Rezultat } from '@/lib/actiuni';
import { ROLURI, ROLURI_IN_PROIECT, STATUSURI_PROIECT, rolInProiectPotrivit } from '@/lib/roluri';

const CHEI_ROL_PROIECT = Object.keys(ROLURI_IN_PROIECT);

// =============================================================================
// ASIGNARI (cine lucreaza la ce proiect)
// =============================================================================

async function utilizatorActiv(id: number) {
    const rows = (await sql`SELECT id, nume, rol, activ FROM utilizatori WHERE id = ${id}`) as {
        id: number;
        nume: string;
        rol: string;
        activ: boolean;
    }[];
    const u = rows[0];
    if (!u) throw new EroareActiune('Angajatul nu exista.');
    if (!u.activ) throw new EroareActiune(`Contul lui ${u.nume} este dezactivat.`);
    return u;
}

function verificaRolPotrivit(rolInProiect: string, angajat: { nume: string; rol: string }) {
    if (!rolInProiectPotrivit(rolInProiect, angajat.rol)) {
        const def = ROLURI_IN_PROIECT[rolInProiect];
        throw new EroareActiune(
            `${def.label} poate fi ocupat doar de: ${def.roluriPermise.join(' / ')}. ${angajat.nume} este ${angajat.rol}.`
        );
    }
}

export async function adaugaAsignare(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const manager = await requireActionUser(['MANAGER']);
        const proiectId = intreg(fd, 'proiect_id');
        const utilizatorId = intreg(fd, 'utilizator_id');
        const rol = dinLista(fd, 'rol_in_proiect', CHEI_ROL_PROIECT);

        const angajat = await utilizatorActiv(utilizatorId);
        verificaRolPotrivit(rol, angajat);

        const rows = await sql`
            INSERT INTO asignari_proiect (proiect_id, utilizator_id, rol_in_proiect, asignat_de)
            SELECT ${proiectId}, ${utilizatorId}, ${rol}, ${manager.id}
            WHERE EXISTS (SELECT 1 FROM proiecte WHERE id = ${proiectId})
            ON CONFLICT (proiect_id, utilizator_id) DO NOTHING
            RETURNING id
        `;
        if (rows.length === 0) throw new EroareActiune(`${angajat.nume} face deja parte din echipa acestui proiect.`);

        await logActivitate(manager.id, proiectId, 'ASIGNARE_ADAUGATA', `${angajat.nume} - ${rol}`);
        return `${angajat.nume} a fost asignat ca ${ROLURI_IN_PROIECT[rol].label.toLowerCase()}.`;
    });
}

export async function modificaAsignare(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const manager = await requireActionUser(['MANAGER']);
        const id = intreg(fd, 'id');
        const rol = dinLista(fd, 'rol_in_proiect', CHEI_ROL_PROIECT);

        const rows = (await sql`
            SELECT a.proiect_id, u.nume, u.rol FROM asignari_proiect a
            JOIN utilizatori u ON u.id = a.utilizator_id WHERE a.id = ${id}
        `) as { proiect_id: number; nume: string; rol: string }[];
        const a = rows[0];
        if (!a) throw new EroareActiune('Asignarea nu mai exista.');
        verificaRolPotrivit(rol, a);

        await sql`UPDATE asignari_proiect SET rol_in_proiect = ${rol} WHERE id = ${id}`;
        await logActivitate(manager.id, a.proiect_id, 'ASIGNARE_MODIFICATA', `${a.nume} -> ${rol}`);
        return `Rolul lui ${a.nume} a fost actualizat.`;
    });
}

export async function stergeAsignare(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const manager = await requireActionUser(['MANAGER']);
        const id = intreg(fd, 'id');
        const rows = (await sql`
            DELETE FROM asignari_proiect a USING utilizatori u
            WHERE a.id = ${id} AND u.id = a.utilizator_id
            RETURNING a.proiect_id, u.nume
        `) as { proiect_id: number; nume: string }[];
        if (!rows[0]) throw new EroareActiune('Asignarea nu mai exista.');
        await logActivitate(manager.id, rows[0].proiect_id, 'ASIGNARE_STEARSA', rows[0].nume);
        return `${rows[0].nume} a fost scos din echipa.`;
    });
}

// =============================================================================
// PROIECTE (CRUD)
// =============================================================================

function codComanda(fd: FormData): string {
    const cod = text(fd, 'cod_comanda', { max: 40 }).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(cod)) {
        throw new EroareActiune('Codul comenzii poate contine doar litere, cifre si "-" (ex: CMD-2026-008).');
    }
    return cod;
}

export async function creeazaProiect(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const manager = await requireActionUser(['MANAGER']);
        const cod = codComanda(fd);
        const titlu = text(fd, 'titlu', { max: 200 });
        const descriere = text(fd, 'descriere', { obligatoriu: false, max: 2000 }) || null;
        const status = dinLista(fd, 'status', STATUSURI_PROIECT);
        const termen = data(fd, 'termen_limita');

        const rows = (await sql`
            INSERT INTO proiecte (cod_comanda, titlu, descriere, status, creat_de_id, termen_limita, finalizat_la)
            VALUES (${cod}, ${titlu}, ${descriere}, ${status}, ${manager.id}, ${termen},
                    CASE WHEN ${status} = 'FINALIZAT' THEN NOW() END)
            RETURNING id
        `) as { id: number }[];

        await logActivitate(manager.id, rows[0].id, 'PROIECT_CREAT', cod);
        return `Proiectul ${cod} a fost creat. Urmatorul pas: asigneaza echipa.`;
    });
}

export async function modificaProiect(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const manager = await requireActionUser(['MANAGER']);
        const id = intreg(fd, 'id');
        const cod = codComanda(fd);
        const titlu = text(fd, 'titlu', { max: 200 });
        const descriere = text(fd, 'descriere', { obligatoriu: false, max: 2000 }) || null;
        const status = dinLista(fd, 'status', STATUSURI_PROIECT);
        const termen = data(fd, 'termen_limita');

        const rows = (await sql`
            UPDATE proiecte SET
                cod_comanda = ${cod}, titlu = ${titlu}, descriere = ${descriere},
                status = ${status}, termen_limita = ${termen},
                finalizat_la = CASE
                    WHEN ${status} = 'FINALIZAT' THEN COALESCE(finalizat_la, NOW())
                    ELSE NULL END
            WHERE id = ${id}
            RETURNING id
        `) as { id: number }[];
        if (!rows[0]) throw new EroareActiune('Proiectul nu mai exista.');

        await logActivitate(manager.id, id, 'PROIECT_MODIFICAT', cod);
        return `Proiectul ${cod} a fost actualizat.`;
    });
}

export async function stergeProiect(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const manager = await requireActionUser(['MANAGER']);
        const id = intreg(fd, 'id');
        // stergerea in cascada elimina BOM-ul, plansele, testele si asignarile
        const rows = (await sql`DELETE FROM proiecte WHERE id = ${id} RETURNING cod_comanda`) as {
            cod_comanda: string;
        }[];
        if (!rows[0]) throw new EroareActiune('Proiectul nu mai exista.');
        await logActivitate(manager.id, null, 'PROIECT_STERS', rows[0].cod_comanda);
        return `Proiectul ${rows[0].cod_comanda} a fost sters impreuna cu BOM-ul si plansele.`;
    });
}

// =============================================================================
// UTILIZATORI (CRUD)
// =============================================================================

function email(fd: FormData): string {
    const v = text(fd, 'email', { max: 160 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new EroareActiune('Adresa de email nu este valida.');
    return v;
}

function parola(fd: FormData, obligatoriu: boolean): string | null {
    const v = String(fd.get('parola') ?? '');
    if (!v && !obligatoriu) return null;
    if (v.length < 8) throw new EroareActiune('Parola trebuie sa aiba minim 8 caractere.');
    if (new TextEncoder().encode(v).length > 72) throw new EroareActiune('Parola este prea lunga (max 72 octeti).');
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) throw new EroareActiune('Parola trebuie sa contina litere si cifre.');
    return v;
}

function departamentId(fd: FormData): number | null {
    const v = String(fd.get('departament_id') ?? '');
    return v ? intreg(fd, 'departament_id') : null;
}

export async function creeazaUtilizator(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const manager = await requireActionUser(['MANAGER']);
        const nume = text(fd, 'nume', { max: 120 });
        const mail = email(fd);
        const rol = dinLista(fd, 'rol', ROLURI);
        const dep = departamentId(fd);
        const hash = await bcrypt.hash(parola(fd, true)!, 10);

        const rows = (await sql`
            INSERT INTO utilizatori (nume, email, parola_hash, rol, departament_id)
            VALUES (${nume}, ${mail}, ${hash}, ${rol}, ${dep})
            RETURNING id
        `) as { id: number }[];
        await logActivitate(manager.id, null, 'UTILIZATOR_CREAT', `${nume} (${rol}) #${rows[0].id}`);
        return `Contul pentru ${nume} a fost creat.`;
    });
}

export async function modificaUtilizator(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const manager = await requireActionUser(['MANAGER']);
        const id = intreg(fd, 'id');
        const nume = text(fd, 'nume', { max: 120 });
        const mail = email(fd);
        const rol = dinLista(fd, 'rol', ROLURI);
        const dep = departamentId(fd);
        const activ = fd.get('activ') === 'on';
        const parolaNoua = parola(fd, false);

        if (id === manager.id && (rol !== 'MANAGER' || !activ)) {
            throw new EroareActiune('Nu iti poti retrage singur rolul de manager sau dezactiva propriul cont.');
        }

        const hash = parolaNoua ? await bcrypt.hash(parolaNoua, 10) : null;
        const rows = (await sql`
            UPDATE utilizatori SET
                nume = ${nume}, email = ${mail}, rol = ${rol}, departament_id = ${dep}, activ = ${activ},
                parola_hash = COALESCE(${hash}, parola_hash)
            WHERE id = ${id}
            RETURNING id
        `) as { id: number }[];
        if (!rows[0]) throw new EroareActiune('Utilizatorul nu mai exista.');

        // asignari care nu mai corespund noului rol (ex: operator ramas responsabil de testare)
        const asignari = (await sql`
            SELECT rol_in_proiect FROM asignari_proiect WHERE utilizator_id = ${id}
        `) as { rol_in_proiect: string }[];
        const nepotrivite = asignari.filter((a) => !rolInProiectPotrivit(a.rol_in_proiect, rol)).length;

        await logActivitate(manager.id, null, 'UTILIZATOR_MODIFICAT', `${nume} (${rol}${activ ? '' : ', inactiv'})`);
        return nepotrivite > 0
            ? `Contul a fost actualizat. Atentie: ${nepotrivite} asignari nu mai corespund rolului ${rol}.`
            : `Contul lui ${nume} a fost actualizat.`;
    });
}

export async function stergeUtilizator(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        const manager = await requireActionUser(['MANAGER']);
        const id = intreg(fd, 'id');
        if (id === manager.id) throw new EroareActiune('Nu iti poti sterge propriul cont.');

        const [istoric] = (await sql`
            SELECT
                (SELECT count(*) FROM proiecte WHERE creat_de_id = ${id})::int AS proiecte,
                (SELECT count(*) FROM verificari_componente WHERE verificat_de_id = ${id})::int AS teste
        `) as { proiecte: number; teste: number }[];
        if (istoric.proiecte > 0 || istoric.teste > 0) {
            throw new EroareActiune(
                `Contul are ${istoric.proiecte} proiecte create si ${istoric.teste} teste semnate. ` +
                    'Istoricul trebuie pastrat - dezactiveaza contul in loc sa il stergi.'
            );
        }

        const rows = (await sql`DELETE FROM utilizatori WHERE id = ${id} RETURNING nume`) as { nume: string }[];
        if (!rows[0]) throw new EroareActiune('Utilizatorul nu mai exista.');
        await logActivitate(manager.id, null, 'UTILIZATOR_STERS', rows[0].nume);
        return `Contul lui ${rows[0].nume} a fost sters.`;
    });
}

// =============================================================================
// DEPARTAMENTE (CRUD)
// =============================================================================

function codDepartament(fd: FormData): string {
    const cod = text(fd, 'cod_departament', { max: 20 }).toUpperCase();
    if (!/^[A-Z0-9_]{2,20}$/.test(cod)) throw new EroareActiune('Codul departamentului: 2-20 litere/cifre (ex: QC).');
    return cod;
}

export async function creeazaDepartament(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        await requireActionUser(['MANAGER']);
        const cod = codDepartament(fd);
        const denumire = text(fd, 'denumire', { max: 120 });
        await sql`INSERT INTO departamente (cod_departament, denumire) VALUES (${cod}, ${denumire})`;
        return `Departamentul ${cod} a fost adaugat.`;
    });
}

export async function modificaDepartament(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        await requireActionUser(['MANAGER']);
        const id = intreg(fd, 'id');
        const cod = codDepartament(fd);
        const denumire = text(fd, 'denumire', { max: 120 });
        const rows = await sql`
            UPDATE departamente SET cod_departament = ${cod}, denumire = ${denumire} WHERE id = ${id} RETURNING id
        `;
        if (!rows[0]) throw new EroareActiune('Departamentul nu mai exista.');
        return `Departamentul ${cod} a fost actualizat.`;
    });
}

export async function stergeDepartament(_: Rezultat, fd: FormData): Promise<Rezultat> {
    return executa(async () => {
        await requireActionUser(['MANAGER']);
        const id = intreg(fd, 'id');
        // utilizatorii raman fara departament (ON DELETE SET NULL)
        const rows = (await sql`DELETE FROM departamente WHERE id = ${id} RETURNING cod_departament`) as {
            cod_departament: string;
        }[];
        if (!rows[0]) throw new EroareActiune('Departamentul nu mai exista.');
        return `Departamentul ${rows[0].cod_departament} a fost sters.`;
    });
}
