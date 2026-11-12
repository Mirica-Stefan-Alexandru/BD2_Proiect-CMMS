# Indecsi - justificare prin planuri de executie

Generat automat de `npm run db:explain` la 08.11.2026, 20:47:24.

Metoda: intr-o tranzactie anulata la final (ROLLBACK) se genereaza un volum realist de date, apoi pentru fiecare index
se masoara interogarea reala din aplicatie cu `EXPLAIN (ANALYZE, BUFFERS)` fara index si cu index. Baza de date nu este modificata.

Volum de test: {"proiecte":5006,"asignari":15006,"componente":50017,"teste":75018,"jurnal":100000}

| Index | Plan fara index | Timp | Plan cu index | Timp | Castig |
|---|---|---|---|---|---|
| `idx_asignari_utilizator` | Seq Scan | 0.897 ms | Bitmap Heap Scan | 0.126 ms | **7.1x** |
| `idx_proiecte_status_termen` | Seq Scan | 0.628 ms | Index Scan | 0.080 ms | **7.8x** |
| `idx_componente_verificat_de` | Seq Scan | 3.510 ms | Bitmap Heap Scan | 0.100 ms | **35.1x** |
| `idx_verificari_componenta_data` | Seq Scan | 3.804 ms | Index Scan | 0.041 ms | **92.8x** |
| `idx_verificari_utilizator` | Seq Scan | 4.559 ms | Bitmap Heap Scan | 0.222 ms | **20.5x** |
| `idx_jurnal_utilizator_data` | Seq Scan | 5.338 ms | Index Scan | 0.077 ms | **69.3x** |
| `idx_jurnal_proiect_data` | Seq Scan | 5.778 ms | Bitmap Heap Scan | 0.087 ms | **66.4x** |

Observatie: PostgreSQL nu indexeaza automat cheile straine. Coloanele `proiect_id` din asignari / BOM / planse si
`plansa_id` din componente_schema sunt deja acoperite de constrangerile UNIQUE compuse (coloana de start), deci nu au
nevoie de index separat.

### idx_asignari_utilizator

Dashboard inginer/operator si overview echipa: proiectele unui angajat (asignari dupa utilizator).

```sql
CREATE INDEX idx_asignari_utilizator ON asignari_proiect (utilizator_id);
```

Interogare:

```sql
SELECT a.proiect_id, a.rol_in_proiect FROM asignari_proiect a WHERE a.utilizator_id = 650
```

**Inainte (fara index)**

```
Seq Scan on asignari_proiect a  (cost=0.00..438.58 rows=51 width=21) (actual time=0.192..0.872 rows=51.00 loops=1)
  Filter: (utilizator_id = 650)
  Rows Removed by Filter: 14955
  Buffers: shared hit=251
Planning Time: 0.059 ms
Execution Time: 0.897 ms
```

**Dupa (cu index)**

```
Bitmap Heap Scan on asignari_proiect a  (cost=4.68..132.30 rows=51 width=21) (actual time=0.027..0.099 rows=51.00 loops=1)
  Recheck Cond: (utilizator_id = 650)
  Heap Blocks: exact=50
  Buffers: shared hit=52
  ->  Bitmap Index Scan on idx_asignari_utilizator  (cost=0.00..4.67 rows=51 width=0) (actual time=0.013..0.014 rows=51.00 loops=1)
        Index Cond: (utilizator_id = 650)
        Index Searches: 1
        Buffers: shared hit=2
Planning Time: 0.062 ms
Execution Time: 0.126 ms
```

### idx_proiecte_status_termen

Filtrarea dashboard-ului dupa status, ordonata dupa termenul limita.

```sql
CREATE INDEX idx_proiecte_status_termen ON proiecte (status, termen_limita);
```

Interogare:

```sql
SELECT id, cod_comanda, termen_limita FROM proiecte WHERE status = 'TESTARE_RECE' ORDER BY termen_limita LIMIT 50
```

**Inainte (fara index)**

```
Limit  (cost=228.17..228.29 rows=50 width=16) (actual time=0.597..0.604 rows=50.00 loops=1)
  Buffers: shared hit=124
  ->  Sort  (cost=228.17..231.30 rows=1252 width=16) (actual time=0.597..0.599 rows=50.00 loops=1)
        Sort Key: termen_limita
        Sort Method: top-N heapsort  Memory: 28kB
        Buffers: shared hit=124
        ->  Seq Scan on proiecte  (cost=0.00..186.57 rows=1252 width=16) (actual time=0.014..0.465 rows=1252.00 loops=1)
              Filter: ((status)::text = 'TESTARE_RECE'::text)
              Rows Removed by Filter: 3754
              Buffers: shared hit=124
Planning Time: 0.074 ms
Execution Time: 0.628 ms
```

**Dupa (cu index)**

```
Limit  (cost=0.28..20.96 rows=50 width=16) (actual time=0.018..0.058 rows=50.00 loops=1)
  Buffers: shared hit=52
  ->  Index Scan using idx_proiecte_status_termen on proiecte  (cost=0.28..518.10 rows=1252 width=16) (actual time=0.017..0.054 rows=50.00 loops=1)
        Index Cond: ((status)::text = 'TESTARE_RECE'::text)
        Index Searches: 1
        Buffers: shared hit=52
Planning Time: 0.077 ms
Execution Time: 0.080 ms
```

### idx_componente_verificat_de

Performanta angajat: cate componente a bifat in ultimele 30 de zile (index partial).

```sql
CREATE INDEX idx_componente_verificat_de ON componente_proiect (verificat_de, verificat_la) WHERE verificat_de IS NOT NULL;
```

Interogare:

```sql
SELECT count(*) FROM componente_proiect WHERE verificat_de = 650 AND verificat AND verificat_la > NOW() - INTERVAL '30 days'
```

**Inainte (fara index)**

```
Aggregate  (cost=2187.36..2187.37 rows=1 width=8) (actual time=3.480..3.481 rows=1.00 loops=1)
  Buffers: shared hit=1187
  ->  Seq Scan on componente_proiect  (cost=0.00..2187.34 rows=7 width=0) (actual time=0.909..3.474 rows=25.00 loops=1)
        Filter: (verificat AND (verificat_de = 650) AND (verificat_la > (now() - '30 days'::interval)))
        Rows Removed by Filter: 49992
        Buffers: shared hit=1187
Planning Time: 0.077 ms
Execution Time: 3.510 ms
```

**Dupa (cu index)**

```
Aggregate  (cost=66.72..66.73 rows=1 width=8) (actual time=0.070..0.070 rows=1.00 loops=1)
  Buffers: shared hit=27
  ->  Bitmap Heap Scan on componente_proiect  (cost=4.46..66.70 rows=9 width=0) (actual time=0.029..0.066 rows=25.00 loops=1)
        Recheck Cond: ((verificat_de = 650) AND (verificat_la > (now() - '30 days'::interval)))
        Filter: verificat
        Heap Blocks: exact=25
        Buffers: shared hit=27
        ->  Bitmap Index Scan on idx_componente_verificat_de  (cost=0.00..4.46 rows=17 width=0) (actual time=0.017..0.017 rows=25.00 loops=1)
              Index Cond: ((verificat_de = 650) AND (verificat_la > (now() - '30 days'::interval)))
              Index Searches: 1
              Buffers: shared hit=2
Planning Time: 0.100 ms
Execution Time: 0.100 ms
```

### idx_verificari_componenta_data

Ultimul test al unei componente (vizualizator SVG, fisa de receptie).

```sql
CREATE INDEX idx_verificari_componenta_data ON verificari_componente (componenta_id, data_verificare DESC);
```

Interogare:

```sql
SELECT status_test FROM verificari_componente WHERE componenta_id = 49242 ORDER BY data_verificare DESC LIMIT 1
```

**Inainte (fara index)**

```
Limit  (cost=2041.74..2041.74 rows=1 width=13) (actual time=3.779..3.779 rows=1.00 loops=1)
  Buffers: shared hit=1104
  ->  Sort  (cost=2041.74..2041.75 rows=3 width=13) (actual time=3.777..3.778 rows=1.00 loops=1)
        Sort Key: data_verificare DESC
        Sort Method: top-N heapsort  Memory: 25kB
        Buffers: shared hit=1104
        ->  Seq Scan on verificari_componente  (cost=0.00..2041.72 rows=3 width=13) (actual time=3.675..3.770 rows=3.00 loops=1)
              Filter: (componenta_id = 49242)
              Rows Removed by Filter: 75015
              Buffers: shared hit=1104
Planning Time: 0.068 ms
Execution Time: 3.804 ms
```

**Dupa (cu index)**

```
Limit  (cost=0.42..4.27 rows=1 width=13) (actual time=0.019..0.019 rows=1.00 loops=1)
  Buffers: shared hit=4
  ->  Index Scan using idx_verificari_componenta_data on verificari_componente  (cost=0.42..11.97 rows=3 width=13) (actual time=0.018..0.018 rows=1.00 loops=1)
        Index Cond: (componenta_id = 49242)
        Index Searches: 1
        Buffers: shared hit=4
Planning Time: 0.074 ms
Execution Time: 0.041 ms
```

### idx_verificari_utilizator

Performanta inginer: teste semnate (total si ultimele 30 de zile).

```sql
CREATE INDEX idx_verificari_utilizator ON verificari_componente (verificat_de_id, data_verificare DESC);
```

Interogare:

```sql
SELECT count(*) FILTER (WHERE data_verificare > NOW() - INTERVAL '30 days') FROM verificari_componente WHERE verificat_de_id = 650
```

**Inainte (fara index)**

```
Aggregate  (cost=2044.20..2044.21 rows=1 width=8) (actual time=4.523..4.523 rows=1.00 loops=1)
  Buffers: shared hit=1104
  ->  Seq Scan on verificari_componente  (cost=0.00..2041.72 rows=248 width=8) (actual time=1.245..4.475 rows=249.00 loops=1)
        Filter: (verificat_de_id = 650)
        Rows Removed by Filter: 74769
        Buffers: shared hit=1104
Planning Time: 0.060 ms
Execution Time: 4.559 ms
```

**Dupa (cu index)**

```
Aggregate  (cost=603.09..603.10 rows=1 width=8) (actual time=0.190..0.191 rows=1.00 loops=1)
  Buffers: shared hit=90
  ->  Bitmap Heap Scan on verificari_componente  (cost=6.21..600.62 rows=247 width=8) (actual time=0.032..0.144 rows=249.00 loops=1)
        Recheck Cond: (verificat_de_id = 650)
        Heap Blocks: exact=88
        Buffers: shared hit=90
        ->  Bitmap Index Scan on idx_verificari_utilizator  (cost=0.00..6.15 rows=247 width=0) (actual time=0.019..0.019 rows=249.00 loops=1)
              Index Cond: (verificat_de_id = 650)
              Index Searches: 1
              Buffers: shared hit=2
Planning Time: 0.070 ms
Execution Time: 0.222 ms
```

### idx_jurnal_utilizator_data

Profil angajat: ultimele 20 de actiuni din jurnal.

```sql
CREATE INDEX idx_jurnal_utilizator_data ON jurnal_activitate (utilizator_id, creat_la DESC);
```

Interogare:

```sql
SELECT actiune, detalii, creat_la FROM jurnal_activitate WHERE utilizator_id = 650 ORDER BY creat_la DESC LIMIT 20
```

**Inainte (fara index)**

```
Limit  (cost=3128.86..3128.91 rows=20 width=62) (actual time=5.309..5.312 rows=20.00 loops=1)
  Buffers: shared hit=1870
  ->  Sort  (cost=3128.86..3129.69 rows=333 width=62) (actual time=5.308..5.309 rows=20.00 loops=1)
        Sort Key: creat_la DESC
        Sort Method: top-N heapsort  Memory: 27kB
        Buffers: shared hit=1870
        ->  Seq Scan on jurnal_activitate  (cost=0.00..3120.00 rows=333 width=62) (actual time=1.015..5.263 rows=334.00 loops=1)
              Filter: (utilizator_id = 650)
              Rows Removed by Filter: 99666
              Buffers: shared hit=1870
Planning Time: 0.068 ms
Execution Time: 5.338 ms
```

**Dupa (cu index)**

```
Limit  (cost=0.29..74.39 rows=20 width=62) (actual time=0.019..0.054 rows=20.00 loops=1)
  Buffers: shared hit=22
  ->  Index Scan using idx_jurnal_utilizator_data on jurnal_activitate  (cost=0.29..1234.01 rows=333 width=62) (actual time=0.019..0.052 rows=20.00 loops=1)
        Index Cond: (utilizator_id = 650)
        Index Searches: 1
        Buffers: shared hit=22
Planning Time: 0.079 ms
Execution Time: 0.077 ms
```

### idx_jurnal_proiect_data

Pagina proiectului: jurnalul proiectului.

```sql
CREATE INDEX idx_jurnal_proiect_data ON jurnal_activitate (proiect_id, creat_la DESC);
```

Interogare:

```sql
SELECT actiune, creat_la FROM jurnal_activitate WHERE proiect_id = 6340 ORDER BY creat_la DESC LIMIT 30
```

**Inainte (fara index)**

```
Limit  (cost=3120.43..3120.48 rows=20 width=30) (actual time=5.747..5.751 rows=20.00 loops=1)
  Buffers: shared hit=1870
  ->  Sort  (cost=3120.43..3120.48 rows=20 width=30) (actual time=5.746..5.748 rows=20.00 loops=1)
        Sort Key: creat_la DESC
        Sort Method: quicksort  Memory: 26kB
        Buffers: shared hit=1870
        ->  Seq Scan on jurnal_activitate  (cost=0.00..3120.00 rows=20 width=30) (actual time=1.042..5.736 rows=20.00 loops=1)
              Filter: (proiect_id = 6340)
              Rows Removed by Filter: 99980
              Buffers: shared hit=1870
Planning Time: 0.069 ms
Execution Time: 5.778 ms
```

**Dupa (cu index)**

```
Limit  (cost=78.92..78.97 rows=20 width=30) (actual time=0.058..0.061 rows=20.00 loops=1)
  Buffers: shared hit=22
  ->  Sort  (cost=78.92..78.97 rows=20 width=30) (actual time=0.057..0.058 rows=20.00 loops=1)
        Sort Key: creat_la DESC
        Sort Method: quicksort  Memory: 26kB
        Buffers: shared hit=22
        ->  Bitmap Heap Scan on jurnal_activitate  (cost=4.45..78.49 rows=20 width=30) (actual time=0.024..0.050 rows=20.00 loops=1)
              Recheck Cond: (proiect_id = 6340)
              Heap Blocks: exact=20
              Buffers: shared hit=22
              ->  Bitmap Index Scan on idx_jurnal_proiect_data  (cost=0.00..4.44 rows=20 width=0) (actual time=0.013..0.013 rows=20.00 loops=1)
                    Index Cond: (proiect_id = 6340)
                    Index Searches: 1
                    Buffers: shared hit=2
Planning Time: 0.078 ms
Execution Time: 0.087 ms
```
