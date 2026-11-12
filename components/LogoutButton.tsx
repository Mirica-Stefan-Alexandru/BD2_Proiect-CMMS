'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (err: unknown) {
            console.error('Eroare logout:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleLogout}
            disabled={loading}
            className="px-3.5 py-2 bg-[#393E46] hover:bg-[#FFD369] text-[#EEEEEE] hover:text-[#222831] rounded-xl text-xs font-semibold border border-[#EEEEEE]/15 hover:border-[#FFD369] transition-colors"
        >
            {loading ? 'Iesire...' : 'Deconectare'}
        </button>
    );
}