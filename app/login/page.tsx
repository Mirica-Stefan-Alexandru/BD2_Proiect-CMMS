'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [parola, setParola] = useState('');
    const [eroare, setEroare] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setEroare('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, parola }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Autentificare esuata');
            }

            // revenire la pagina ceruta inainte de login (doar cai interne)
            const next = new URLSearchParams(window.location.search).get('next');
            const destinatie = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
            router.push(destinatie);
            router.refresh();
        } catch (err: unknown) {
            if (err instanceof Error) {
                setEroare(err.message);
            } else {
                setEroare('A aparut o eroare neasteptata.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-[#222831] text-[#EEEEEE] selection:bg-[#FFD369] selection:text-[#222831] overflow-hidden">
            <div className="relative z-20 w-full lg:w-[440px] xl:w-[480px] min-h-screen bg-[#393E46] lg:rounded-r-[2.5rem] border-r border-[#EEEEEE]/15 shadow-2xl shadow-black/60 flex flex-col justify-between p-8 sm:p-12">
                <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full bg-[#222831] text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Server Online
                    </span>
                    <span className="text-xs font-mono text-[#EEEEEE]/50">v1.0 EPLAN</span>
                </div>

                <div className="my-auto py-8 anim-fade-up">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-24 h-24 rounded-2xl bg-[#222831] border-2 border-[#FFD369] flex flex-col items-center justify-center shadow-lg shadow-black/30 mb-6">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-[#EEEEEE]/60">
                                Sistem
                            </span>
                            <span className="text-3xl font-black tracking-tighter text-[#FFD369] leading-none my-0.5">
                                CMMS
                            </span>
                            <span className="text-[9px] font-mono uppercase tracking-wider text-[#EEEEEE]/80">
                                Industrial
                            </span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#EEEEEE] uppercase">
                            Autentificare
                        </h1>
                        <p className="text-xs text-[#EEEEEE]/60 mt-1.5">
                            Introdu datele de acces pentru panoul de comanda si verificare
                        </p>
                    </div>

                    {eroare && (
                        <div className="mb-6 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs font-medium text-center">
                            {eroare}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#EEEEEE]/70 mb-1.5 ml-1">
                                Adresa Email
                            </label>
                            <div className="flex items-stretch rounded-xl overflow-hidden border border-[#EEEEEE]/20 focus-within:border-[#FFD369] bg-[#222831] transition-colors">
                                <div className="w-12 bg-[#FFD369] text-[#222831] flex items-center justify-center font-bold text-base shrink-0">
                                    @
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="cristian.dumitru@factory.ro"
                                    className="w-full px-3.5 py-3 bg-transparent text-sm text-[#EEEEEE] placeholder-[#EEEEEE]/35 focus:outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#EEEEEE]/70 mb-1.5 ml-1">
                                Parola Acces
                            </label>
                            <div className="flex items-stretch rounded-xl overflow-hidden border border-[#EEEEEE]/20 focus-within:border-[#FFD369] bg-[#222831] transition-colors">
                                <div className="w-12 bg-[#FFD369] text-[#222831] flex items-center justify-center shrink-0">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-4 h-4"
                                    >
                                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                    </svg>
                                </div>
                                <input
                                    type="password"
                                    value={parola}
                                    onChange={(e) => setParola(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-3.5 py-3 bg-transparent text-sm text-[#EEEEEE] placeholder-[#EEEEEE]/35 focus:outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div className="pt-3">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-6 bg-[#FFD369] hover:bg-[#FFD369]/90 disabled:bg-[#FFD369]/50 text-[#222831] font-bold rounded-full text-xs uppercase tracking-wider transition-all shadow-lg shadow-black/25 cursor-pointer"
                            >
                                {loading ? 'Se verifica...' : 'Intra in cont'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="text-center border-t border-[#EEEEEE]/10 pt-4">
                    <p className="text-[11px] text-[#EEEEEE]/50">
                        accesul este permis doar personalului autorizat (Manager, Inginer, Operator)
                    </p>
                </div>
            </div>

            <div className="hidden lg:flex flex-1 relative bg-[#222831] overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#393E46_1px,transparent_1px),linear-gradient(to_bottom,#393E46_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-40" />
                <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#FFD369]/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 left-12 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />

                <div className="relative z-10 m-auto max-w-lg px-12 space-y-8">
                    <div className="anim-fade-up">
                        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#FFD369]">
                            Paperless shop floor
                        </span>
                        <h2 className="mt-3 text-4xl font-extrabold tracking-tight leading-tight text-[#EEEEEE]">
                            De la schema EPLAN la tabloul receptionat, fara hartie.
                        </h2>
                    </div>
                    <ul className="space-y-3">
                        {[
                            ['01', 'Import BOM din EPLAN', 'Lista de materiale CSV devine checklist in cateva milisecunde.'],
                            ['02', 'Scheme SVG interactive', 'Reperele (-KM1, -QF1) sunt detectate automat pe plansa.'],
                            ['03', 'Testare la rece semnata', 'Fiecare verificare pastreaza inginerul si ora exacta.'],
                            ['04', 'Rapoarte & performanta', 'Export CSV / Excel / PDF si overview pe fiecare angajat.'],
                        ].map(([nr, titlu, text], i) => (
                            <li
                                key={nr}
                                style={{ animationDelay: `${150 + i * 90}ms` }}
                                className="anim-fade-up flex gap-4 items-start bg-[#393E46]/50 border border-[#EEEEEE]/10 rounded-2xl p-4 backdrop-blur-sm"
                            >
                                <span className="font-mono text-xs font-bold text-[#222831] bg-[#FFD369] rounded-lg px-2 py-1">{nr}</span>
                                <div>
                                    <p className="text-sm font-semibold text-[#EEEEEE]">{titlu}</p>
                                    <p className="text-xs text-[#EEEEEE]/60 mt-0.5">{text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}