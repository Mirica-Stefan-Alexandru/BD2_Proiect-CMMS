'use client';

import { btnPrimar } from '@/components/ui';

export default function PrintButton() {
    return (
        <button type="button" onClick={() => window.print()} className={btnPrimar}>
            Printeaza / Salveaza PDF
        </button>
    );
}
