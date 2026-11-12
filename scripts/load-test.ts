// Test de incarcare pentru API (fara dependinte, foloseste fetch nativ).
// Rulare (cu serverul pornit: npm run build && npm start):
//   $env:LOAD_EMAIL="..."; $env:LOAD_PAROLA="..."; npm run test:load
// Variabile optionale:
//   BASE_URL   (implicit http://localhost:3000)
//   CONCURENTA (implicit 20 de clienti simultani)
//   DURATA_S   (implicit 20 secunde per endpoint)
//   LOAD_TOKEN (JWT existent, in loc de email/parola)
// Rezultatele sunt scrise in docs/load-test-rezultate.md
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CONCURENTA = Number(process.env.CONCURENTA ?? 20);
const DURATA_S = Number(process.env.DURATA_S ?? 20);

async function obtineCookie(): Promise<string | null> {
    if (process.env.LOAD_TOKEN) return `cmms_session=${process.env.LOAD_TOKEN}`;
    if (!process.env.LOAD_EMAIL || !process.env.LOAD_PAROLA) return null;
    const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: process.env.LOAD_EMAIL, parola: process.env.LOAD_PAROLA }),
    });
    if (!r.ok) throw new Error(`Login esuat: HTTP ${r.status}`);
    return (r.headers.get('set-cookie') ?? '').split(';')[0];
}

interface Rezultat {
    endpoint: string;
    cereri: number;
    erori: number;
    rps: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    medie: number;
    coduri: Record<string, number>;
}

const percentila = (s: number[], p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0);

async function ruleaza(endpoint: string, cookie: string | null): Promise<Rezultat> {
    const latente: number[] = [];
    const coduri: Record<string, number> = {};
    let erori = 0;
    const sfarsit = Date.now() + DURATA_S * 1000;

    const client = async () => {
        while (Date.now() < sfarsit) {
            const t = performance.now();
            try {
                const r = await fetch(BASE + endpoint, { headers: cookie ? { cookie } : {} });
                await r.arrayBuffer();
                coduri[r.status] = (coduri[r.status] ?? 0) + 1;
                if (!r.ok) erori++;
            } catch {
                coduri['retea'] = (coduri['retea'] ?? 0) + 1;
                erori++;
            }
            latente.push(performance.now() - t);
        }
    };

    const start = performance.now();
    await Promise.all(Array.from({ length: CONCURENTA }, client));
    const durata = (performance.now() - start) / 1000;
    const s = [...latente].sort((a, b) => a - b);
    return {
        endpoint,
        cereri: s.length,
        erori,
        rps: s.length / durata,
        p50: percentila(s, 50),
        p95: percentila(s, 95),
        p99: percentila(s, 99),
        max: s[s.length - 1] ?? 0,
        medie: s.reduce((a, b) => a + b, 0) / (s.length || 1),
        coduri,
    };
}

const cookie = await obtineCookie();
const endpointuri = ['/api/health', ...(cookie ? ['/api/proiecte', '/api/proiecte/104'] : [])];
if (!cookie) console.log('Fara credentiale (LOAD_EMAIL/LOAD_PAROLA): se testeaza doar /api/health.');

const rezultate: Rezultat[] = [];
for (const e of endpointuri) {
    // incalzire (compilare, conexiuni)
    await fetch(BASE + e, { headers: cookie ? { cookie } : {} }).then((r) => r.arrayBuffer()).catch(() => {});
    console.log(`> ${e}: ${CONCURENTA} clienti x ${DURATA_S}s ...`);
    const r = await ruleaza(e, cookie);
    rezultate.push(r);
    console.log(
        `  ${r.cereri} cereri, ${r.rps.toFixed(1)} req/s, p50 ${r.p50.toFixed(0)} ms, p95 ${r.p95.toFixed(0)} ms, ` +
            `p99 ${r.p99.toFixed(0)} ms, erori ${r.erori} (${((r.erori / r.cereri) * 100).toFixed(2)}%)`
    );
}

const md = [
    '# Test de incarcare API',
    '',
    `Generat de \`npm run test:load\` la ${new Date().toLocaleString('ro-RO')}.`,
    '',
    `- Server: \`${BASE}\` (build de productie, \`next start\`)`,
    `- Clienti simultani: **${CONCURENTA}**, durata: **${DURATA_S} s** per endpoint`,
    '- Fiecare client trimite cereri consecutive (closed-loop); latenta include tot drumul HTTP + interogarile PostgreSQL (Neon).',
    '',
    '| Endpoint | Cereri | Req/s | Medie | p50 | p95 | p99 | Max | Erori | Coduri HTTP |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rezultate.map(
        (r) =>
            `| \`${r.endpoint}\` | ${r.cereri} | ${r.rps.toFixed(1)} | ${r.medie.toFixed(0)} ms | ${r.p50.toFixed(0)} ms | ` +
            `${r.p95.toFixed(0)} ms | ${r.p99.toFixed(0)} ms | ${r.max.toFixed(0)} ms | ${r.erori} | ${JSON.stringify(r.coduri)} |`
    ),
    '',
    'Interpretare:',
    '- `/api/health` masoara costul minim (un `SELECT 1`), deci latenta de retea pana la baza de date.',
    '- `/api/proiecte` verifica JWT-ul si executa o interogare cu `LATERAL` + `EXISTS` (foloseste `idx_asignari_utilizator`).',
    '- `/api/proiecte/:id` verifica accesul si ruleaza 3 interogari in paralel (proiect, echipa, BOM).',
    '',
].join('\n');
mkdirSync('docs', { recursive: true });
writeFileSync('docs/load-test-rezultate.md', md);
console.log('Rezultate scrise in docs/load-test-rezultate.md');
