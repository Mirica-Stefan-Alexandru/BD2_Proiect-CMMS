'use client';

import { ActionForm, Modal, SubmitButton } from '@/components/forms';
import { btnPericol, btnPrimar, btnSecundar, inputCls, labelCls } from '@/components/ui';
import { LABEL_STATUS, STATUSURI_PROIECT } from '@/lib/roluri';
import { creeazaProiect, modificaProiect, stergeProiect } from '@/app/admin/actions';

export interface ProiectEditabil {
    id: number;
    cod_comanda: string;
    titlu: string;
    descriere: string | null;
    status: string;
    termen: string; // YYYY-MM-DD
}

export function ProiectModal({ proiect, sugestieCod }: { proiect?: ProiectEditabil; sugestieCod?: string }) {
    const editare = !!proiect;
    return (
        <Modal
            titlu={editare ? `Editeaza ${proiect.cod_comanda}` : 'Proiect nou'}
            buton={editare ? 'Editeaza' : '+ Proiect nou'}
            clasaButon={editare ? `${btnSecundar} px-2.5! py-1.5!` : btnPrimar}
        >
            {(inchide) => (
                <ActionForm action={editare ? modificaProiect : creeazaProiect} reseteaza={!editare} onSucces={inchide} mesajSus className="space-y-4">
                    {editare && <input type="hidden" name="id" value={proiect.id} />}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls} htmlFor="cod_comanda">Cod comanda</label>
                            <input
                                id="cod_comanda"
                                name="cod_comanda"
                                required
                                maxLength={40}
                                pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,39}"
                                defaultValue={proiect?.cod_comanda ?? sugestieCod}
                                placeholder="CMD-2026-008"
                                className={`${inputCls} font-mono uppercase`}
                            />
                        </div>
                        <div>
                            <label className={labelCls} htmlFor="termen_limita">Termen limita</label>
                            <input id="termen_limita" type="date" name="termen_limita" required defaultValue={proiect?.termen} className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} htmlFor="titlu">Titlu tablou</label>
                        <input id="titlu" name="titlu" required maxLength={200} defaultValue={proiect?.titlu} placeholder="Tablou comanda ..." className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls} htmlFor="descriere">Descriere (optional)</label>
                        <textarea id="descriere" name="descriere" rows={3} maxLength={2000} defaultValue={proiect?.descriere ?? ''} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls} htmlFor="status">Status</label>
                        <select id="status" name="status" defaultValue={proiect?.status ?? 'PLANIFICAT'} className={inputCls}>
                            {STATUSURI_PROIECT.map((s) => (
                                <option key={s} value={s}>
                                    {LABEL_STATUS[s]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={inchide} className={btnSecundar}>
                            Anuleaza
                        </button>
                        <SubmitButton textAsteptare="Se salveaza...">{editare ? 'Salveaza modificarile' : 'Creeaza proiectul'}</SubmitButton>
                    </div>
                </ActionForm>
            )}
        </Modal>
    );
}

export function StergeProiectForm({ id, cod }: { id: number; cod: string }) {
    return (
        <ActionForm
            action={stergeProiect}
            confirmare={`Stergi definitiv proiectul ${cod}? Se vor sterge si BOM-ul, plansele, testele si asignarile.`}
        >
            <input type="hidden" name="id" value={id} />
            <SubmitButton className={`${btnPericol} px-2.5! py-1.5!`}>Sterge</SubmitButton>
        </ActionForm>
    );
}
