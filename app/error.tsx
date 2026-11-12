'use client';

import Link from 'next/link';
import { btnPrimar, btnSecundar } from '@/components/ui';

export default function Eroare({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#222831] text-[#EEEEEE] p-6">
            <div className="anim-scale-in text-center space-y-4 bg-[#393E46]/80 border border-red-500/30 rounded-3xl px-10 py-12 shadow-2xl shadow-black/40 max-w-md">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-300 text-xl font-bold">!</div>
                <h1 className="text-xl font-bold">A aparut o eroare</h1>
                <p className="text-sm text-[#EEEEEE]/60">
                    Operatia nu a putut fi finalizata. Daca problema persista, verifica conexiunea la baza de date.
                </p>
                {error.digest && <p className="text-[10px] font-mono text-[#EEEEEE]/40">Cod: {error.digest}</p>}
                <div className="flex justify-center gap-2">
                    <button type="button" onClick={reset} className={btnPrimar}>
                        Reincearca
                    </button>
                    <Link href="/" className={btnSecundar}>
                        Panou central
                    </Link>
                </div>
            </div>
        </div>
    );
}
