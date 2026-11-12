import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import sql from '@/lib/db';
import { getJwtSecret, SESSION_COOKIE } from '@/lib/jwt';
import type { Rol } from '@/lib/roluri';
import { EroareActiune } from '@/lib/actiuni';

export interface SessionUser {
    id: number;
    nume: string;
    email: string;
    rol: Rol;
}

/** Citeste si valideaza JWT-ul din cookie. Fara interogare in baza de date. */
export async function getSessionUser(): Promise<SessionUser | null> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        return {
            id: Number(payload.userId),
            nume: String(payload.nume),
            email: String(payload.email),
            rol: payload.rol as Rol,
        };
    } catch {
        return null;
    }
}

/** Pentru pagini: redirect la login daca nu exista sesiune, la / daca rolul nu are acces. */
export async function requirePageUser(roluri?: Rol[]): Promise<SessionUser> {
    const user = await getSessionUser();
    if (!user) redirect('/login');
    if (roluri && !roluri.includes(user.rol)) redirect('/');
    return user;
}

/**
 * Pentru Server Actions / Route Handlers care modifica date.
 * Re-verifica in baza de date ca utilizatorul este inca activ si foloseste
 * rolul curent din DB (o retrogradare are efect imediat, nu dupa expirarea JWT).
 */
export async function requireActionUser(roluri?: Rol[]): Promise<SessionUser> {
    const user = await getSessionUser();
    if (!user) throw new EroareActiune('Sesiunea a expirat. Autentifica-te din nou.');

    const rows = (await sql`
        SELECT id, nume, email, rol, activ FROM utilizatori WHERE id = ${user.id}
    `) as { id: number; nume: string; email: string; rol: Rol; activ: boolean }[];

    const db = rows[0];
    if (!db || !db.activ) throw new EroareActiune('Contul nu mai este activ.');
    if (roluri && !roluri.includes(db.rol)) throw new EroareActiune('Nu ai drepturi pentru aceasta operatie.');

    return { id: db.id, nume: db.nume, email: db.email, rol: db.rol };
}

/** Rolul utilizatorului in echipa proiectului, sau null daca nu este asignat. */
export async function rolInProiect(userId: number, proiectId: number): Promise<string | null> {
    const rows = (await sql`
        SELECT rol_in_proiect FROM asignari_proiect
        WHERE proiect_id = ${proiectId} AND utilizator_id = ${userId}
    `) as { rol_in_proiect: string }[];
    return rows[0]?.rol_in_proiect ?? null;
}

export interface AccesProiect {
    poateVedea: boolean;
    /** bifeaza componente in BOM (montaj) */
    poateBifa: boolean;
    /** import BOM, editare componente, incarcare planse, schimbare status */
    poateEdita: boolean;
    /** inregistreaza teste la rece (semnatura QC) */
    poateTesta: boolean;
    esteManager: boolean;
    rolInProiect: string | null;
}

export async function accesProiect(user: SessionUser, proiectId: number): Promise<AccesProiect> {
    const esteManager = user.rol === 'MANAGER';
    const rol = await rolInProiect(user.id, proiectId);
    const asignat = rol !== null;
    const inginerAsignat = asignat && user.rol === 'INGINER';
    return {
        poateVedea: esteManager || asignat,
        poateBifa: esteManager || asignat,
        poateEdita: esteManager || inginerAsignat,
        poateTesta: esteManager || inginerAsignat,
        esteManager,
        rolInProiect: rol,
    };
}

/** Varianta pentru actiuni: arunca eroare daca permisiunea lipseste. */
export async function cerePermisiuneProiect(
    proiectId: number,
    permisiune: 'poateVedea' | 'poateBifa' | 'poateEdita' | 'poateTesta'
): Promise<SessionUser> {
    const user = await requireActionUser();
    const acces = await accesProiect(user, proiectId);
    if (!acces[permisiune]) {
        throw new EroareActiune('Nu esti asignat pe acest proiect cu drepturile necesare.');
    }
    return user;
}
