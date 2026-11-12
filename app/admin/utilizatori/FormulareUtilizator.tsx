'use client';

import { ActionForm, Modal, SubmitButton } from '@/components/forms';
import { btnPericol, btnPrimar, btnSecundar, inputCls, labelCls } from '@/components/ui';
import { ROLURI } from '@/lib/roluri';
import {
    creeazaDepartament,
    creeazaUtilizator,
    modificaDepartament,
    modificaUtilizator,
    stergeDepartament,
    stergeUtilizator,
} from '@/app/admin/actions';

export interface Departament {
    id: number;
    cod_departament: string;
    denumire: string;
}

export interface UtilizatorEditabil {
    id: number;
    nume: string;
    email: string;
    rol: string;
    departament_id: number | null;
    activ: boolean;
}

export function UtilizatorModal({
    utilizator,
    departamente,
    deschisInitial = false,
    esteContulMeu = false,
}: {
    utilizator?: UtilizatorEditabil;
    departamente: Departament[];
    deschisInitial?: boolean;
    esteContulMeu?: boolean;
}) {
    const editare = !!utilizator;
    return (
        <Modal
            titlu={editare ? `Editeaza contul - ${utilizator.nume}` : 'Cont nou de angajat'}
            buton={editare ? 'Editeaza' : '+ Angajat nou'}
            clasaButon={editare ? `${btnSecundar} px-2.5! py-1.5!` : btnPrimar}
            deschisInitial={deschisInitial}
        >
            {(inchide) => (
                <ActionForm action={editare ? modificaUtilizator : creeazaUtilizator} reseteaza={!editare} onSucces={editare ? undefined : inchide} mesajSus className="space-y-4">
                    {editare && <input type="hidden" name="id" value={utilizator.id} />}
                    <div>
                        <label className={labelCls} htmlFor="nume">Nume complet</label>
                        <input id="nume" name="nume" required maxLength={120} defaultValue={utilizator?.nume} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls} htmlFor="email">Email</label>
                        <input id="email" type="email" name="email" required maxLength={160} defaultValue={utilizator?.email} placeholder="prenume.nume@factory.ro" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls} htmlFor="rol">Rol in sistem</label>
                            <select id="rol" name="rol" defaultValue={utilizator?.rol ?? 'OPERATOR'} className={inputCls}>
                                {ROLURI.map((r) => (
                                    <option key={r} value={r} disabled={esteContulMeu && r !== 'MANAGER'}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls} htmlFor="departament_id">Departament</label>
                            <select id="departament_id" name="departament_id" defaultValue={utilizator?.departament_id ?? ''} className={inputCls}>
                                <option value="">- fara -</option>
                                {departamente.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.denumire}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} htmlFor="parola">
                            {editare ? 'Parola noua (lasa gol pentru a o pastra)' : 'Parola initiala'}
                        </label>
                        <input
                            id="parola"
                            type="password"
                            name="parola"
                            required={!editare}
                            minLength={8}
                            autoComplete="new-password"
                            placeholder="minim 8 caractere, litere si cifre"
                            className={inputCls}
                        />
                        <p className="text-[10px] text-[#EEEEEE]/40 mt-1">Stocata doar ca hash bcrypt (cost 10), niciodata in clar.</p>
                    </div>
                    {editare && (
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" name="activ" defaultChecked={utilizator.activ} disabled={esteContulMeu} className="accent-[#FFD369] w-4 h-4" />
                            Cont activ (un cont inactiv nu se mai poate autentifica)
                            {esteContulMeu && <input type="hidden" name="activ" value="on" />}
                        </label>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={inchide} className={btnSecundar}>
                            Inchide
                        </button>
                        <SubmitButton textAsteptare="Se salveaza...">{editare ? 'Salveaza' : 'Creeaza contul'}</SubmitButton>
                    </div>
                </ActionForm>
            )}
        </Modal>
    );
}

export function StergeUtilizatorForm({ id, nume }: { id: number; nume: string }) {
    return (
        <ActionForm action={stergeUtilizator} confirmare={`Stergi definitiv contul lui ${nume}?`}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton className={`${btnPericol} px-2.5! py-1.5!`}>Sterge</SubmitButton>
        </ActionForm>
    );
}

export function DepartamentNouForm() {
    return (
        <ActionForm action={creeazaDepartament} reseteaza className="grid grid-cols-[90px_1fr_auto] gap-2">
            <input name="cod_departament" required maxLength={20} placeholder="COD" aria-label="Cod departament" className={`${inputCls} font-mono uppercase`} />
            <input name="denumire" required maxLength={120} placeholder="Denumire departament" aria-label="Denumire" className={inputCls} />
            <SubmitButton>+</SubmitButton>
        </ActionForm>
    );
}

export function DepartamentRand({ departament, angajati }: { departament: Departament; angajati: number }) {
    return (
        <div className="flex items-center gap-2">
            <ActionForm action={modificaDepartament} className="flex-1">
                <input type="hidden" name="id" value={departament.id} />
                <div className="grid grid-cols-[90px_1fr_auto] gap-2 items-center">
                    <input name="cod_departament" defaultValue={departament.cod_departament} required maxLength={20} aria-label="Cod" className={`${inputCls} font-mono uppercase py-1.5!`} />
                    <input name="denumire" defaultValue={departament.denumire} required maxLength={120} aria-label="Denumire" className={`${inputCls} py-1.5!`} />
                    <SubmitButton className={`${btnSecundar} px-2.5! py-1.5!`} title="Salveaza">
                        ✓
                    </SubmitButton>
                </div>
            </ActionForm>
            <span className="text-[10px] font-mono text-[#EEEEEE]/50 w-8 text-center" title="Angajati">
                {angajati}
            </span>
            <ActionForm
                action={stergeDepartament}
                confirmare={`Stergi departamentul ${departament.denumire}? Cei ${angajati} angajati vor ramane fara departament.`}
            >
                <input type="hidden" name="id" value={departament.id} />
                <SubmitButton className={`${btnPericol} px-2.5! py-1.5!`} title="Sterge">
                    ✕
                </SubmitButton>
            </ActionForm>
        </div>
    );
}
