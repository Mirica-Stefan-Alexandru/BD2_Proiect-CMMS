import { NextResponse, type NextRequest } from 'next/server';
import sql from '@/lib/db';
import { accesProiect, getSessionUser } from '@/lib/session';

// GET /api/proiecte/:id - detaliile proiectului, echipa si BOM-ul (doar pentru echipa / manager)
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/proiecte/[id]'>) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: 'Autentificare necesara.' }, { status: 401 });

    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ success: false, error: 'ID invalid.' }, { status: 400 });

    try {
        if (!(await accesProiect(user, id)).poateVedea) {
            return NextResponse.json({ success: false, error: 'Acces interzis.' }, { status: 403 });
        }
        const [proiecte, echipa, componente] = await Promise.all([
            sql`SELECT id, cod_comanda, titlu, descriere, status, termen_limita, creat_la, finalizat_la FROM proiecte WHERE id = ${id}`,
            sql`
                SELECT u.id, u.nume, u.rol, a.rol_in_proiect FROM asignari_proiect a
                JOIN utilizatori u ON u.id = a.utilizator_id WHERE a.proiect_id = ${id}
            `,
            sql`
                SELECT id, cod_reper, descriere, producator, cantitate, verificat, verificat_de, verificat_la
                FROM componente_proiect WHERE proiect_id = ${id} ORDER BY cod_reper
            `,
        ]);
        if (!proiecte[0]) return NextResponse.json({ success: false, error: 'Proiect inexistent.' }, { status: 404 });
        return NextResponse.json({ success: true, data: { ...proiecte[0], echipa, componente } });
    } catch (error) {
        console.error('Eroare baza de date:', error);
        return NextResponse.json({ success: false, error: 'Eroare interna.' }, { status: 500 });
    }
}
