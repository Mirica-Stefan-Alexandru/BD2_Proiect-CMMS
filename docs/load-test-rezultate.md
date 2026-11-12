# Test de incarcare API

Generat de `npm run test:load` la 08.11.2026, 20:50:01.

- Server: `http://localhost:3100` (build de productie, `next start`)
- Clienti simultani: **20**, durata: **15 s** per endpoint
- Fiecare client trimite cereri consecutive (closed-loop); latenta include tot drumul HTTP + interogarile PostgreSQL (Neon).

| Endpoint | Cereri | Req/s | Medie | p50 | p95 | p99 | Max | Erori | Coduri HTTP |
|---|---|---|---|---|---|---|---|---|---|
| `/api/health` | 5361 | 356.4 | 56 ms | 52 ms | 71 ms | 130 ms | 289 ms | 0 | {"200":5361} |
| `/api/proiecte` | 4496 | 299.4 | 67 ms | 62 ms | 87 ms | 140 ms | 458 ms | 0 | {"200":4496} |
| `/api/proiecte/104` | 3031 | 200.8 | 99 ms | 93 ms | 132 ms | 195 ms | 219 ms | 0 | {"200":3031} |

Interpretare:
- `/api/health` masoara costul minim (un `SELECT 1`), deci latenta de retea pana la baza de date.
- `/api/proiecte` verifica JWT-ul si executa o interogare cu `LATERAL` + `EXISTS` (foloseste `idx_asignari_utilizator`).
- `/api/proiecte/:id` verifica accesul si ruleaza 3 interogari in paralel (proiect, echipa, BOM).
