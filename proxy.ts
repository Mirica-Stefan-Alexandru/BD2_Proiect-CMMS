import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret, SESSION_COOKIE } from '@/lib/jwt';

// RBAC la nivel de ruta, verificat doar din JWT (fara interogare in baza de date).
// Fiecare Server Action / Route Handler re-verifica permisiunile langa date.
const RUTE_PROTEJATE: Record<string, string[]> = {
    '/admin': ['MANAGER'],
    '/api/admin': ['MANAGER'],
    '/rapoarte': ['MANAGER', 'INGINER'],
    '/api/rapoarte': ['MANAGER', 'INGINER'],
};

export default async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get(SESSION_COOKIE)?.value;

    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/auth') ||
        pathname === '/api/health' ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    if (pathname === '/login') {
        if (token) {
            try {
                await jwtVerify(token, getJwtSecret());
                return NextResponse.redirect(new URL('/', request.url));
            } catch {
                const response = NextResponse.next();
                response.cookies.delete(SESSION_COOKIE);
                return response;
            }
        }
        return NextResponse.next();
    }

    if (!token) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Autentificare necesara.' }, { status: 401 });
        }
        const login = new URL('/login', request.url);
        if (pathname !== '/') login.searchParams.set('next', pathname);
        return NextResponse.redirect(login);
    }

    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        const rolUtilizator = payload.rol as string;

        const rutaConfigurata = Object.keys(RUTE_PROTEJATE).find(
            (r) => pathname === r || pathname.startsWith(r + '/')
        );

        if (rutaConfigurata) {
            const roluriPermise = RUTE_PROTEJATE[rutaConfigurata];
            if (!roluriPermise.includes(rolUtilizator)) {
                if (pathname.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Acces interzis.' }, { status: 403 });
                }
                return NextResponse.redirect(new URL('/', request.url));
            }
        }

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', String(payload.userId));
        requestHeaders.set('x-user-rol', rolUtilizator);

        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
    } catch {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Sesiune invalida.' }, { status: 401 });
        }
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete(SESSION_COOKIE);
        return response;
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
