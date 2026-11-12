import Link from 'next/link';
import type { ReactNode } from 'react';
import LogoutButton from '@/components/LogoutButton';
import NavLinks, { type NavItem } from '@/components/NavLinks';
import type { SessionUser } from '@/lib/session';
import { getRoleBadge, initiale } from '@/lib/ui';

function navPentru(rol: string): NavItem[] {
    const items: NavItem[] = [{ href: '/', label: 'Panou Central', exact: true }];
    if (rol === 'MANAGER') {
        items.push(
            { href: '/admin/asignari', label: 'Asignari' },
            { href: '/admin/echipa', label: 'Echipa & Performanta' },
            { href: '/admin/proiecte', label: 'Proiecte' },
            { href: '/admin/utilizatori', label: 'Utilizatori' }
        );
    }
    if (rol === 'MANAGER' || rol === 'INGINER') {
        items.push({ href: '/rapoarte', label: 'Rapoarte' });
    }
    return items;
}

export default function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
    return (
        <div className="min-h-screen bg-[#222831] text-[#EEEEEE] flex flex-col relative selection:bg-[#FFD369] selection:text-[#222831]">
            <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#393E46_1px,transparent_1px),linear-gradient(to_bottom,#393E46_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25" />
            <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[48rem] h-80 rounded-full bg-[#FFD369]/[0.06] blur-3xl" />

            <header className="no-print sticky top-0 z-30 border-b border-[#393E46] bg-[#222831]/85 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
                    <Link href="/" className="flex items-center gap-3.5 group shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-[#FFD369] flex items-center justify-center font-bold text-[#222831] shadow-md shadow-black/30 transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105">
                            CM
                        </div>
                        <div className="hidden md:block">
                            <div className="flex items-center gap-2">
                                <span className="text-base font-bold tracking-tight text-[#EEEEEE]">CMMS Industrial</span>
                                <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Sistem Activ
                                </span>
                            </div>
                            <p className="text-xs text-[#EEEEEE]/60">Panou de Comanda &amp; Verificare EPLAN</p>
                        </div>
                    </Link>

                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-[#393E46]">
                            <div className="w-9 h-9 rounded-full bg-[#393E46] border border-[#EEEEEE]/15 flex items-center justify-center text-xs font-bold text-[#FFD369]">
                                {initiale(user.nume)}
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-semibold text-[#EEEEEE] leading-none">{user.nume}</div>
                                <div className="flex items-center justify-end gap-2 mt-1">
                                    <span className="hidden lg:inline text-xs text-[#EEEEEE]/60">{user.email}</span>
                                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${getRoleBadge(user.rol)}`}>
                                        {user.rol}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <LogoutButton />
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <NavLinks items={navPentru(user.rol)} />
                </div>
            </header>

            <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-8">{children}</main>

            <footer className="no-print relative z-10 border-t border-[#393E46] py-4 text-center text-[11px] font-mono text-[#EEEEEE]/40">
                CMMS Industrial &middot; integrare EPLAN Electric P8 &middot; paperless shop floor
            </footer>
        </div>
    );
}
