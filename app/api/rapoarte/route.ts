import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { construiesteRaport, TIPURI_RAPORT, type TipRaport } from '@/lib/rapoarte';
import { genereazaCsv } from '@/lib/csv';
import { genereazaXlsx } from '@/lib/xlsx';

// GET /api/rapoarte?tip=proiecte|bom|verificari|performanta|jurnal&format=csv|xlsx[&proiect=ID]
export async function GET(request: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Autentificare necesara.' }, { status: 401 });
    if (user.rol !== 'MANAGER' && user.rol !== 'INGINER') {
        return NextResponse.json({ error: 'Acces interzis.' }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const tip = params.get('tip') ?? '';
    const format = params.get('format') ?? 'csv';
    const proiectBrut = params.get('proiect');
    const proiectId = proiectBrut ? Number(proiectBrut) : null;

    if (!(tip in TIPURI_RAPORT)) return NextResponse.json({ error: 'Tip de raport necunoscut.' }, { status: 400 });
    if (format !== 'csv' && format !== 'xlsx') return NextResponse.json({ error: 'Format necunoscut (csv sau xlsx).' }, { status: 400 });
    if (proiectId !== null && (!Number.isInteger(proiectId) || proiectId <= 0)) {
        return NextResponse.json({ error: 'Proiect invalid.' }, { status: 400 });
    }
    if (TIPURI_RAPORT[tip as TipRaport].doarManager && user.rol !== 'MANAGER') {
        return NextResponse.json({ error: 'Raport disponibil doar managerilor.' }, { status: 403 });
    }

    try {
        const raport = await construiesteRaport(tip as TipRaport, user, proiectId);
        const data = new Date().toISOString().slice(0, 10);
        const numeFisier = `cmms_${tip}${proiectId ? `_proiect-${proiectId}` : ''}_${data}.${format}`;

        const corp =
            format === 'csv'
                ? genereazaCsv(raport.header, raport.randuri)
                : genereazaXlsx([{ nume: raport.titlu, header: raport.header, randuri: raport.randuri }]);

        return new NextResponse(corp as BodyInit, {
            headers: {
                'Content-Type':
                    format === 'csv'
                        ? 'text/csv; charset=utf-8'
                        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${numeFisier}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (e) {
        console.error('[rapoarte] eroare:', e);
        return NextResponse.json({ error: 'Raportul nu a putut fi generat.' }, { status: 500 });
    }
}
