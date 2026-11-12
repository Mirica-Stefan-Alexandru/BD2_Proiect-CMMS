import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getSessionUser } from '@/lib/session';

// GET /api/proiecte - proiectele vizibile utilizatorului curent (managerul vede tot),
// cu progresul BOM. Endpoint folosit si pentru testul de incarcare (npm run test:load).
export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ success: false, error: 'Autentificare necesara.' }, { status: 401 });

    try {
        const proiecte = await sql`
            SELECT p.id, p.cod_comanda, p.titlu, p.status, p.termen_limita, p.creat_la,
                   COALESCE(c.total, 0)::int AS componente, COALESCE(c.verificate, 0)::int AS verificate
            FROM proiecte p
            LEFT JOIN LATERAL (
                SELECT count(*) AS total, count(*) FILTER (WHERE verificat) AS verificate
                FROM componente_proiect WHERE proiect_id = p.id
            ) c ON TRUE
            WHERE ${user.rol === 'MANAGER'}
               OR EXISTS (SELECT 1 FROM asignari_proiect a WHERE a.proiect_id = p.id AND a.utilizator_id = ${user.id})
            ORDER BY p.id ASC
        `;
        return NextResponse.json({ success: true, data: proiecte });
    } catch (error) {
        console.error('Eroare baza de date:', error);
        return NextResponse.json(
            { success: false, error: 'Eroare la preluarea proiectelor' },
            { status: 500 }
        );
    }
}
