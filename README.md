# CMMS Industrial - management, asamblare si testare tablouri electrice

Aplicatie web (Next.js 16 + PostgreSQL/Neon) care elimina hartia din hala de productie: BOM-ul si schemele
exportate din **EPLAN Electric P8** devin checklist-uri digitale, operatorii bifeaza montajul pe tableta,
inginerii semneaza electronic testarea la rece, iar managerul urmareste proiectele si performanta echipei.

## Pornire rapida

```bash
npm install
# .env.local:
#   DATABASE_URL=postgresql://...      (Neon / orice PostgreSQL 14+)
#   JWT_SECRET=<minim 32 de caractere> (obligatoriu in productie)
npm run dev            # sau: npm run build && npm start
```

La pornirea serverului, `instrumentation.ts` aplica automat `db/schema.sql` (idempotent) si, **daca baza este goala**,
insereaza fixtures din `db/seed.sql`. Conturile de test create astfel au parola `Parola2026!`:

| Email | Rol |
|---|---|
| cristian.dumitru@factory.ro | MANAGER |
| mihai.ionescu@factory.ro, elena.radu@factory.ro, alexandra.matei@factory.ro | INGINER |
| ion.popescu@factory.ro, andrei.vasile@factory.ro, radu.constantin@factory.ro | OPERATOR |

Scripturi utile:

| Comanda | Ce face |
|---|---|
| `npm run db:migrate` | Aplica schema + fixtures (doar pe baza goala) manual |
| `npm run db:explain` | EXPLAIN ANALYZE inainte/dupa pentru fiecare index -> `docs/indecsi-explain.md` |
| `npm run test:load` | Test de incarcare API -> `docs/load-test-rezultate.md` |

Variabila `DB_AUTO_MIGRATE=false` dezactiveaza migrarea automata la pornire.

---

## 1. Domeniul aplicatiei

O fabrica de tablouri electrice primeste comenzi (ex. `CMD-2026-004`). Fiecare comanda trece prin etapele:

1. **Proiectare** - inginerul deseneaza schema in EPLAN si exporta lista de materiale (CSV) si plansele (SVG).
2. **Planificare** - managerul creeaza proiectul si aloca echipa (ingineri + operatori) cu roluri de santier.
3. **Asamblare** - operatorii monteaza si cableaza; fiecare componenta din BOM este bifata, cu numele si ora.
4. **Testare la rece** - inginerul responsabil verifica fiecare reper pe schema (continuitate, strangeri, calibre)
   si semneaza rezultatul: VERDE (conform), GALBEN (remediere minora), ROSU (neconform), NEGRU (lipsa / gresit).
5. **Receptie** - cand toate componentele sunt verificate si nu exista neconformitati, proiectul este finalizat;
   se genereaza fisa de receptie PDF.

## 2. Roluri si drepturi (RBAC)

| Actiune | OPERATOR | INGINER | MANAGER |
|---|---|---|---|
| Vede proiectele | doar cele asignate | doar cele asignate | toate |
| Bifeaza componente BOM | da (proiecte asignate) | da | da |
| Debifeaza bifa altcuiva | nu | da | da |
| Import BOM CSV, editare componente, planse SVG, schimbare status | nu | da (proiecte asignate) | da |
| Semneaza teste la rece | nu | da (proiecte asignate) | da |
| Rapoarte proiecte / BOM / teste | nu | da (proiecte asignate) | da |
| Rapoarte performanta / jurnal, asignari, echipa, CRUD proiecte / utilizatori / departamente | nu | nu | da |

Rolurile de santier sunt validate: `RESPONSABIL_TESTARE`, `PROIECTANT_ELECTRIC`, `INGINER_AUTOMATIST` necesita un
inginer; `EXECUTANT_TABLOU` si `CABLARE_SI_MONTAJ` pot fi ocupate de operatori sau ingineri; `MANAGER_PROIECT` de
manager sau inginer. Asignarile vechi care nu respecta regula sunt marcate in pagina Asignari.

## 3. Autentificare

- Parolele sunt stocate doar ca hash **bcrypt** (cost 10). La un email inexistent se compara totusi cu un hash fals,
  ca timpul de raspuns sa nu dezvaluie daca un cont exista.
- La login serverul emite un **JWT HS256** (8 ore) cu `userId`, `rol`, `nume`, salvat intr-un cookie `httpOnly`,
  `sameSite=lax`, `secure` in productie. Sesiunea este stateless.
- `proxy.ts` verifica JWT-ul la fiecare cerere si blocheaza rutele dupa rol (`/admin/*` doar MANAGER,
  `/rapoarte/*` MANAGER + INGINER), fara interogari in baza de date.
- Fiecare Server Action re-verifica in baza de date ca utilizatorul este activ si foloseste rolul curent din DB
  (o dezactivare sau retrogradare are efect imediat), apoi verifica asignarea pe proiect.
- In productie `JWT_SECRET` este obligatoriu; cheia din cod se foloseste doar in dezvoltare.

## 4. Modelul de date (9 tabele + 1 view)

```
departamente 1---n utilizatori 1---n proiecte (creat_de_id)
utilizatori  n---m proiecte        prin asignari_proiect (rol_in_proiect)
proiecte     1---n componente_proiect (BOM; verificat_de -> utilizatori)
proiecte     1---n planse_schema 1---n componente_schema 1---n verificari_componente (verificat_de_id -> utilizatori)
utilizatori / proiecte 1---n jurnal_activitate
view v_verificari_complete = verificari + reper + plansa + proiect + inginer
```

Constrangeri principale (vezi `db/schema.sql`): chei straine cu `CASCADE` / `SET NULL` / `RESTRICT` alese dupa
semantica (istoricul testelor nu poate pierde inginerul semnatar), `UNIQUE (proiect_id, utilizator_id)`,
`UNIQUE (proiect_id, cod_reper)` (permite import CSV de tip UPSERT), `UNIQUE (proiect_id, numar_pagina)`,
`CHECK` pe roluri, statusuri, rezultatele testelor, cantitati > 0 si coordonate 0-100%.

## 5. Indecsi

PostgreSQL nu indexeaza cheile straine. Indecsii adaugati si castigul masurat cu `EXPLAIN ANALYZE` pe un volum
sintetic (5.000 proiecte, 50.000 componente, 75.000 teste, 100.000 intrari jurnal) sunt in
[`docs/indecsi-explain.md`](docs/indecsi-explain.md). Rezumat: toate interogarile trec de la `Seq Scan` la
`Index Scan` / `Bitmap Index Scan`, cu castiguri intre ~7x si ~90x.

## 6. Paginile aplicatiei

| Pagina | Cine | Descriere |
|---|---|---|
| `/login` | toti | Autentificare email + parola. |
| `/` Panou central | toti | Statistici, filtre pe status, cautare; carduri de proiect cu progresul **real** (componente BOM verificate), termen, zile ramase / depasite si echipa. Operatorii si inginerii vad doar proiectele lor. |
| `/proiecte/[id]` | echipa + manager | Fisa proiectului: status, progres BOM si QC, taburi: **Lista materiale** (checklist cu bifare optimista, cine/cand, import CSV EPLAN cu previzualizare, CRUD componente), **Scheme EPLAN** (vizualizator SVG interactiv), **Testare la rece** (istoric si semnare teste), **Echipa & jurnal**. |
| `/admin/asignari` | manager | Atribuirea proiectelor inginerilor si operatorilor, cu validarea rolului; modificare rol, scoatere din echipa; filtre "fara inginer" / "roluri nepotrivite"; incarcarea fiecarui angajat. |
| `/admin/echipa` | manager | Overview pe fiecare angajat: proiecte active / finalizate / depasite, componente bifate, teste semnate, calitate QC, livrare la termen, productivitate, indice de performanta; filtre si sortare; export Excel/CSV. |
| `/admin/echipa/[id]` | manager | Profil angajat: grafic activitate 14 zile, proiecte cu rol si progres, ultimele bifari si teste, jurnal. |
| `/admin/proiecte` | manager | CRUD comenzi (cod, titlu, descriere, status, termen). |
| `/admin/utilizatori` | manager | CRUD conturi (rol, departament, activ, resetare parola) si CRUD departamente. |
| `/rapoarte` | manager, inginer | Exporturi Excel (.xlsx) si CSV: proiecte, BOM, teste, performanta, jurnal. |
| `/rapoarte/proiect/[id]` | manager, inginer | Fisa de receptie printabila -> "Salveaza ca PDF". |

### Integrarea EPLAN

- **BOM (CSV)**: EPLAN *Parts list* exportat ca CSV (`;` sau `,`, UTF-8 sau Windows-1250). Coloanele sunt
  recunoscute automat (`Device tag`/`BMK`/`Cod reper`, `Description`/`Descriere`, `Manufacturer`, `Quantity`,
  `Comment`). Randurile cu acelasi reper sunt unite. Importul este o singura interogare `INSERT ... SELECT FROM unnest(...)`
  cu `ON CONFLICT DO UPDATE`, deci sute de piese se salveaza intr-un round-trip. Exemplu: `public/demo/EPLAN_parts-list_exemplu.csv`.
- **Scheme (PDF)**: un PDF exportat din EPLAN poate fi incarcat direct. Serverul il transforma in SVG cu MuPDF
  (WebAssembly, `lib/pdf.ts`), pagina cu pagina (maxim 40 de pagini, 8 MB), iar textul ramane text, deci reperele se
  detecteaza la fel ca la un SVG nativ. Un PDF scanat (doar imagine) nu are text si nu poate fi analizat automat; aplicatia
  te avertizeaza. Exemplu: `public/demo/plansa_exemplu.pdf`. MuPDF are licenta AGPL-3.0.
- **Scheme (SVG)**: fisierul este igienizat (fara scripturi, handler-e de evenimente, `foreignObject`, link-uri externe)
  pe server si din nou in browser. Vizualizatorul cauta elementele `<text>` cu etichete de echipament (`-KM1`, `=A1+S1-QF2`)
  si deseneaza chenare colorate peste ele, fara calibrare manuala. La primul test semnat, pozitia reperului se salveaza
  automat in `componente_schema` (procente din viewBox). Exemplu: `public/demo/CMD-2026-004_pagina-01.svg`.

## 7. Rapoarte

- **Excel (.xlsx)**: generat fara dependinte (`lib/xlsx.ts`); celulele text sunt `inlineStr`, deci codurile
  `-KM1` nu sunt interpretate ca formule.
- **CSV**: UTF-8 cu BOM (diacritice corecte in Excel), protectie la CSV injection.
- **PDF**: fisa de receptie printabila (echipa, BOM cu semnaturi, ultimul rezultat al fiecarui test, campuri de semnatura).

## 8. Structura codului

```
app/                     pagini (App Router) + route handlers (app/api/*)
  admin/actions.ts       Server Actions administrare (asignari, proiecte, utilizatori, departamente)
  proiecte/[id]/         pagina proiect + actions.ts (BOM, planse, teste, status) + componente client
components/              AppShell, NavLinks, ui.tsx (carduri, badge-uri), forms.tsx (ActionForm, Modal)
lib/                     db, jwt, session (autorizare), actiuni (validare + erori), performanta, rapoarte,
                         csv, xlsx, svg, migrations
db/schema.sql            schema idempotenta (tabele, constrangeri, view, indecsi)
db/seed.sql              fixtures
scripts/                 db-migrate, explain-indecsi, load-test
docs/                    rezultatele EXPLAIN si ale testului de incarcare
```
