import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { getJwtSecret, SESSION_COOKIE, SESSION_DURATA_SECUNDE } from '@/lib/jwt';
import { logActivitate } from '@/lib/actiuni';

// Hash fals folosit cand emailul nu exista, ca timpul de raspuns sa nu
// dezvaluie daca un cont exista sau nu (protectie la enumerarea conturilor).
let hashFals: string | null = null;
const HASH_FALS = () => (hashFals ??= bcrypt.hashSync('cont-inexistent-cmms', 10));

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null);
        const email = typeof body?.email === 'string' ? body.email.trim() : '';
        const parola = typeof body?.parola === 'string' ? body.parola : '';

        if (!email || !parola) {
            return NextResponse.json(
                { error: 'Emailul si parola sunt obligatorii.' },
                { status: 400 }
            );
        }

        const utilizatori = await sql`
            SELECT id, nume, email, parola_hash, rol, activ
            FROM utilizatori
            WHERE LOWER(TRIM(email)) = LOWER(${email})
        `;

        const utilizator = utilizatori[0];
        const parolaValida = await bcrypt.compare(parola, utilizator?.parola_hash ?? HASH_FALS());

        if (!utilizator || !parolaValida) {
            return NextResponse.json(
                { error: 'Credentiale invalide.' },
                { status: 401 }
            );
        }

        if (!utilizator.activ) {
            return NextResponse.json(
                { error: 'Contul este dezactivat.' },
                { status: 403 }
            );
        }

        const token = await new SignJWT({
            userId: utilizator.id,
            email: utilizator.email,
            rol: utilizator.rol,
            nume: utilizator.nume,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(`${SESSION_DURATA_SECUNDE}s`)
            .sign(getJwtSecret());

        await logActivitate(utilizator.id, null, 'AUTENTIFICARE');

        const response = NextResponse.json({
            success: true,
            user: {
                id: utilizator.id,
                nume: utilizator.nume,
                email: utilizator.email,
                rol: utilizator.rol,
            },
        });

        response.cookies.set({
            name: SESSION_COOKIE,
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_DURATA_SECUNDE,
        });

        return response;
    } catch (error) {
        console.error('Eroare login:', error);
        return NextResponse.json(
            { error: 'Eroare interna de server.' },
            { status: 500 }
        );
    }
}
