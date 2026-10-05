// Enlaces directos al Kiosko, sin pasar por el login de admin:
//   ?kiosko=<id de la sede>  -> Kiosko fijo de esa sede (tablet / celular de planta)
//   ?kiosko=movil            -> Marcación desde el celular del empleado (varias sedes)

export type KioskLink =
    | { type: 'sede'; companyId: string }
    | { type: 'movil' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARAM = 'kiosko';

// Devuelve null si no hay parámetro. Un valor presente pero inválido se trata
// como enlace de sede con id no reconocible, para mostrar el error en vez de
// caer silenciosamente en el login o en otra sede.
export function parseKioskLink(search: string): KioskLink | null {
    const value = new URLSearchParams(search).get(PARAM)?.trim();
    if (!value) return null;
    if (value.toLowerCase() === 'movil') return { type: 'movil' };
    return { type: 'sede', companyId: UUID_RE.test(value) ? value.toLowerCase() : '' };
}

export function buildKioskLink(origin: string, companyId: string): string {
    return `${origin}/?${PARAM}=${companyId}`;
}

export function buildMobileKioskLink(origin: string): string {
    return `${origin}/?${PARAM}=movil`;
}
