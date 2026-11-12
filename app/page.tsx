import type { Metadata } from 'next';
import Link from 'next/link';
import sql from '@/lib/db';
import { requirePageUser } from '@/lib/session';
import AppShell from '@/components/AppShell';
import { Avatar, btnPrimar, btnSecundar, CodBadge, delay, EmptyState, ProgressBar, StatCard, StatusBadge } from '@/components/ui';
import { calculeazaProgres, formatData, getStatusConfig, zileRamase } from '@/lib/ui';

export const instant = false;

export const metadata: Metadata = {
  title: 'Panou Central',
  description: 'Sistem de management si verificare pentru tablouri electrice si scheme EPLAN',
};

interface ProiectDashboard {
  id: number;
  cod_comanda: string;
  titlu: string;
  status: string;
  termen_limita: string;
  total: number;
  verificate: number;
  echipa: { nume: string; rol: string }[] | null;
}

export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const user = await requirePageUser();
  const esteManager = user.rol === 'MANAGER';

  const filtre = await searchParams;
  const statusSelectat = typeof filtre?.status === 'string' ? filtre.status : 'TOATE';
  const qBrut = typeof filtre?.q === 'string' ? filtre.q : '';
  const cautare = qBrut.trim().toLowerCase();

  // Managerul vede toate comenzile; inginerii si operatorii doar proiectele pe care sunt asignati.
  const toateProiectele = (await sql`
    SELECT p.id, p.cod_comanda, p.titlu, p.status, p.termen_limita,
           COALESCE(c.total, 0)::int      AS total,
           COALESCE(c.verificate, 0)::int AS verificate,
           e.echipa
    FROM proiecte p
    LEFT JOIN LATERAL (
      SELECT count(*) AS total, count(*) FILTER (WHERE verificat) AS verificate
      FROM componente_proiect WHERE proiect_id = p.id
    ) c ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('nume', u.nume, 'rol', u.rol) ORDER BY u.nume) AS echipa
      FROM asignari_proiect a JOIN utilizatori u ON u.id = a.utilizator_id
      WHERE a.proiect_id = p.id
    ) e ON TRUE
    WHERE ${esteManager}
       OR EXISTS (SELECT 1 FROM asignari_proiect a WHERE a.proiect_id = p.id AND a.utilizator_id = ${user.id})
    ORDER BY (p.status = 'FINALIZAT'), p.termen_limita ASC
  `) as ProiectDashboard[];

  const proiecteFiltrate = toateProiectele.filter((p) => {
    const potrivireStatus = statusSelectat === 'TOATE' || p.status === statusSelectat;
    const potrivireText =
      !cautare || p.cod_comanda.toLowerCase().includes(cautare) || p.titlu.toLowerCase().includes(cautare);
    return potrivireStatus && potrivireText;
  });

  const nr = (s: string) => toateProiectele.filter((p) => p.status === s).length;
  const statistici = {
    total: toateProiectele.length,
    inLucru: nr('IN_LUCRU'),
    testareRece: nr('TESTARE_RECE'),
    planificate: nr('PLANIFICAT'),
    finalizate: nr('FINALIZAT'),
    intarziate: toateProiectele.filter((p) => p.status !== 'FINALIZAT' && zileRamase(p.termen_limita) < 0).length,
  };

  const taburiStatus = [
    { cod: 'TOATE', label: 'Toate Comenzile', count: statistici.total },
    { cod: 'TESTARE_RECE', label: 'Testare la Rece', count: statistici.testareRece },
    { cod: 'IN_LUCRU', label: 'In Lucru', count: statistici.inLucru },
    { cod: 'PLANIFICAT', label: 'Planificate', count: statistici.planificate },
    { cod: 'FINALIZAT', label: 'Finalizate', count: statistici.finalizate },
  ];

  const hrefTab = (cod: string) => {
    const p = new URLSearchParams();
    if (cod !== 'TOATE') p.set('status', cod);
    if (cautare) p.set('q', cautare);
    const s = p.toString();
    return s ? `/?${s}` : '/';
  };

  return (
    <AppShell user={user}>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0}
          label={esteManager ? 'Total comenzi' : 'Proiectele mele'}
          valoare={statistici.total}
          indicator={<span className="font-mono text-[#FFD369]">DB-SYNC</span>}
          detaliu={
            statistici.intarziate > 0 ? (
              <span className="text-red-300 font-medium">{statistici.intarziate} depasite</span>
            ) : (
              <span className="text-emerald-400 font-medium">{statistici.finalizate} finalizate</span>
            )
          }
        />
        <StatCard
          index={1}
          ton="galben"
          label="In testare la rece"
          valoare={statistici.testareRece}
          indicator={<span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
          detaliu="Verificare tehnica"
        />
        <StatCard
          index={2}
          ton="albastru"
          label="In executie / cablare"
          valoare={statistici.inLucru}
          indicator={<span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />}
          detaliu="In productie"
        />
        <StatCard
          index={3}
          label="Planificate"
          valoare={statistici.planificate}
          indicator={<span className="font-mono text-[#EEEEEE]/50">Q4/Q1</span>}
          detaliu="In asteptare"
        />
      </section>

      <section
        style={delay(4, 60)}
        className="anim-fade-up bg-[#393E46]/60 border border-[#EEEEEE]/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#EEEEEE]">
              {esteManager ? 'Comenzi & Proiecte Industriale' : 'Proiectele la care lucrezi'}
            </h2>
            <p className="text-sm text-[#EEEEEE]/60">
              Selecteaza un proiect pentru a deschide plansele electrice EPLAN si lista de echipamente
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form method="GET" action="/" className="flex items-center gap-2">
              {statusSelectat !== 'TOATE' && <input type="hidden" name="status" value={statusSelectat} />}
              <div className="relative flex-1 sm:w-72">
                <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#EEEEEE]/40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  name="q"
                  defaultValue={qBrut}
                  placeholder="Cauta cod comanda sau titlu..."
                  className="w-full bg-[#222831] border border-[#EEEEEE]/15 focus:border-[#FFD369] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#EEEEEE] placeholder-[#EEEEEE]/40 focus:outline-none transition-colors"
                />
              </div>
              <button type="submit" className={btnPrimar}>
                Filtreaza
              </button>
              {(cautare || statusSelectat !== 'TOATE') && (
                <Link href="/" className={btnSecundar}>
                  Reset
                </Link>
              )}
            </form>
            {esteManager && (
              <Link href="/admin/proiecte" className={btnSecundar}>
                + Proiect nou
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-3 border-t border-[#EEEEEE]/10">
          {taburiStatus.map((tab) => {
            const activ = statusSelectat === tab.cod;
            return (
              <Link
                key={tab.cod}
                href={hrefTab(tab.cod)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border ${
                  activ
                    ? 'bg-[#FFD369] text-[#222831] border-[#FFD369] shadow-sm shadow-[#FFD369]/20'
                    : 'bg-[#222831]/70 text-[#EEEEEE]/70 border-[#EEEEEE]/10 hover:border-[#FFD369]/50 hover:text-[#EEEEEE]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 rounded-md text-[10px] font-mono ${
                    activ ? 'bg-[#222831]/20 text-[#222831]' : 'bg-[#393E46] text-[#EEEEEE]/80'
                  }`}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {proiecteFiltrate.length === 0 ? (
        toateProiectele.length === 0 && !esteManager ? (
          <EmptyState
            titlu="Nu esti asignat inca pe niciun proiect."
            descriere="Managerul de productie te poate adauga in echipa unei comenzi din pagina Asignari. Proiectele vor aparea aici automat."
          />
        ) : (
          <EmptyState
            titlu="Niciun proiect gasit pentru filtrele selectate."
            descriere="Incearca sa resetezi filtrele de status sau termenul cautat."
            actiune={
              <Link href="/" className={btnPrimar}>
                Afiseaza toate proiectele
              </Link>
            }
          />
        )
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {proiecteFiltrate.map((proiect, i) => {
            const cfg = getStatusConfig(proiect.status);
            const zile = zileRamase(proiect.termen_limita);
            const progres = calculeazaProgres(proiect.status, proiect.total, proiect.verificate);
            const depasit = proiect.status !== 'FINALIZAT' && zile < 0;
            const echipa = proiect.echipa ?? [];

            return (
              <article
                key={proiect.id}
                style={delay(i + 5)}
                className={`anim-fade-up card-glow group relative bg-[#393E46]/80 border rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 ${
                  depasit ? 'border-red-500/30 hover:border-red-400/60' : 'border-[#EEEEEE]/10 hover:border-[#FFD369]/60'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <CodBadge>{proiect.cod_comanda}</CodBadge>
                    <StatusBadge status={proiect.status} />
                  </div>

                  <div>
                    <h3 className="font-bold text-[#EEEEEE] text-lg group-hover:text-[#FFD369] transition-colors line-clamp-1" title={proiect.titlu}>
                      {proiect.titlu}
                    </h3>
                    <p className="text-xs text-[#EEEEEE]/60 mt-1">{cfg.etapa}</p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#EEEEEE]/70">
                        {proiect.total > 0
                          ? `Componente verificate ${proiect.verificate}/${proiect.total}`
                          : 'Stadiu estimat (BOM neimportat)'}
                      </span>
                      <span className="font-mono font-semibold text-[#EEEEEE]">{progres}%</span>
                    </div>
                    <ProgressBar valoare={progres} culoare={progres === 100 ? 'bg-emerald-400' : cfg.bar} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="bg-[#222831]/80 border border-[#EEEEEE]/10 rounded-xl p-2.5">
                      <span className="block text-[10px] uppercase text-[#EEEEEE]/50">Termen Limita</span>
                      <span className="text-xs font-medium text-[#EEEEEE]">{formatData(proiect.termen_limita)}</span>
                    </div>
                    <div className="bg-[#222831]/80 border border-[#EEEEEE]/10 rounded-xl p-2.5">
                      <span className="block text-[10px] uppercase text-[#EEEEEE]/50">Timp Ramas</span>
                      <span
                        className={`text-xs font-mono font-medium ${
                          proiect.status === 'FINALIZAT'
                            ? 'text-emerald-400'
                            : depasit
                              ? 'text-red-400'
                              : zile < 14
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                        }`}
                      >
                        {proiect.status === 'FINALIZAT'
                          ? 'Livrat'
                          : zile > 0
                            ? `${zile} zile`
                            : zile === 0
                              ? 'Azi'
                              : `Depasit ${-zile} zile`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-[#EEEEEE]/10 flex items-center justify-between gap-3">
                  <div className="flex items-center -space-x-2" aria-label="Echipa proiectului">
                    {echipa.slice(0, 4).map((m) => (
                      <div key={m.nume} className="ring-2 ring-[#393E46] rounded-full">
                        <Avatar nume={m.nume} marime="sm" />
                      </div>
                    ))}
                    {echipa.length > 4 && (
                      <span className="ml-3 text-[10px] font-mono text-[#EEEEEE]/60">+{echipa.length - 4}</span>
                    )}
                    {echipa.length === 0 && (
                      <span className="text-[11px] font-mono text-amber-300/80">Fara echipa</span>
                    )}
                  </div>
                  <Link href={`/proiecte/${proiect.id}`} prefetch={true} className={btnPrimar}>
                    <span>Deschide Proiect</span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </AppShell>
  );
}
