import { NextResponse, connection } from 'next/server';
import sql from '@/lib/db';

// GET /api/health - verificare disponibilitate server + baza de date (fara autentificare,
// nu expune date). Util pentru monitorizare si ca reper in testul de incarcare.
export async function GET() {
    await connection(); // raspuns calculat la fiecare request, nu la build
    const start = performance.now();
    try {
        await sql`SELECT 1`;
        return NextResponse.json(
            { status: 'ok', db_ms: Math.round(performance.now() - start) },
            { headers: { 'Cache-Control': 'no-store' } }
        );
    } catch {
        return NextResponse.json({ status: 'db_indisponibila' }, { status: 503 });
    }
}
