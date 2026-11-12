import Link from 'next/link';
import { btnPrimar } from '@/components/ui';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#222831] text-[#EEEEEE] p-6 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#393E46_1px,transparent_1px),linear-gradient(to_bottom,#393E46_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-25" />
            <div className="anim-scale-in relative text-center space-y-4 bg-[#393E46]/80 border border-[#EEEEEE]/10 rounded-3xl px-10 py-12 shadow-2xl shadow-black/40">
                <div className="font-mono text-6xl font-black text-[#FFD369]">404</div>
                <h1 className="text-xl font-bold">Pagina nu exista</h1>
                <p className="text-sm text-[#EEEEEE]/60 max-w-sm">Proiectul sau pagina cautata a fost stearsa sau adresa este gresita.</p>
                <Link href="/" className={btnPrimar}>
                    Inapoi la panoul central
                </Link>
            </div>
        </div>
    );
}
