import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import sql from '@/lib/db';

/** Eroare cu mesaj sigur de afisat utilizatorului. */
export class EroareActiune extends Error {}

export type Rezultat = { ok: boolean; mesaj: string; ts?: number } | null;

/**
 * Ruleaza o operatie de scriere si o transforma intr-un rezultat afisabil in UI.
 * - erorile de validare (EroareActiune) sunt afisate ca atare
 * - erorile PostgreSQL cunoscute primesc un mesaj prietenos
 * - orice alta eroare este logata pe server, iar clientul primeste un mesaj generic
 */
export async function executa(operatie: () => Promise<string>): Promise<Rezultat> {
    try {
        const mesaj = await operatie();
        revalidatePath('/', 'layout');
        return { ok: true, mesaj, ts: Date.now() };
    } catch (e) {
        unstable_rethrow(e); // redirect(), notFound() etc.
        if (e instanceof EroareActiune) return { ok: false, mesaj: e.message, ts: Date.now() };

        const cod = (e as { code?: string })?.code;
        if (cod === '23505') return { ok: false, mesaj: 'Exista deja o inregistrare cu aceste date (valoare unica).', ts: Date.now() };
        if (cod === '23503') return { ok: false, mesaj: 'Inregistrarea este folosita in alte tabele si nu poate fi stearsa/modificata.', ts: Date.now() };
        if (cod === '23514') return { ok: false, mesaj: 'Valorile nu respecta constrangerile bazei de date.', ts: Date.now() };

        console.error('[actiune] eroare neasteptata:', e);
        return { ok: false, mesaj: 'Eroare interna de server. Incearca din nou.', ts: Date.now() };
    }
}

export async function logActivitate(
    utilizatorId: number | null,
    proiectId: number | null,
    actiune: string,
    detalii?: string
): Promise<void> {
    try {
        await sql`
            INSERT INTO jurnal_activitate (utilizator_id, proiect_id, actiune, detalii)
            VALUES (${utilizatorId}, ${proiectId}, ${actiune}, ${detalii ?? null})
        `;
    } catch (e) {
        // jurnalul nu trebuie sa blocheze operatia principala
        console.error('[jurnal] nu s-a putut salva activitatea:', e);
    }
}

// ---- validare campuri din FormData --------------------------------------------

export function text(fd: FormData, camp: string, { obligatoriu = true, max = 500 } = {}): string {
    const v = String(fd.get(camp) ?? '').trim();
    if (obligatoriu && !v) throw new EroareActiune(`Campul "${camp}" este obligatoriu.`);
    if (v.length > max) throw new EroareActiune(`Campul "${camp}" depaseste ${max} caractere.`);
    return v;
}

export function intreg(fd: FormData, camp: string, { min = 1, max = 2_147_483_647 } = {}): number {
    const v = Number(fd.get(camp));
    if (!Number.isInteger(v) || v < min || v > max) {
        throw new EroareActiune(`Valoare invalida pentru "${camp}".`);
    }
    return v;
}

export function dinLista<T extends string>(fd: FormData, camp: string, lista: readonly T[]): T {
    const v = String(fd.get(camp) ?? '');
    if (!lista.includes(v as T)) throw new EroareActiune(`Valoare invalida pentru "${camp}".`);
    return v as T;
}

export function data(fd: FormData, camp: string): string {
    const v = String(fd.get(camp) ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
        throw new EroareActiune(`Data invalida pentru "${camp}".`);
    }
    return v;
}
