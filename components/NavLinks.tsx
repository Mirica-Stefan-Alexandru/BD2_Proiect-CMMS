'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
    href: string;
    label: string;
    exact?: boolean;
}

export default function NavLinks({ items }: { items: NavItem[] }) {
    const pathname = usePathname();

    return (
        <nav className="flex items-center gap-1 overflow-x-auto -mb-px" aria-label="Navigare principala">
            {items.map((item) => {
                const activ = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={activ ? 'page' : undefined}
                        className={`relative px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                            activ ? 'text-[#FFD369]' : 'text-[#EEEEEE]/60 hover:text-[#EEEEEE]'
                        }`}
                    >
                        {item.label}
                        <span
                            className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-[#FFD369] transition-all duration-300 ${
                                activ ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
                            }`}
                        />
                    </Link>
                );
            })}
        </nav>
    );
}
