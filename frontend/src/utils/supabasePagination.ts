const DEFAULT_PAGE_SIZE = 1000;

/**
 * Supabase/PostgREST limita cada consulta a un máximo de filas por defecto
 * (típicamente 1000) aunque no se pida ningún .limit() explícito. Para
 * tablas que pueden crecer más allá de eso (ej. InA_time_entries en una
 * sede con suficiente historial), un .select() normal pierde filas en
 * silencio, sin ningún error. Este helper pagina con .range() hasta traer
 * todo, para consultas que genuinamente necesitan el conjunto completo.
 */
export async function fetchAllRows<T = any>(
    queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
    pageSize = DEFAULT_PAGE_SIZE
): Promise<{ data: T[]; error: any }> {
    const allRows: T[] = [];
    let from = 0;

    while (true) {
        const { data, error } = await queryFactory(from, from + pageSize - 1);
        if (error) return { data: allRows, error };
        allRows.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
    }

    return { data: allRows, error: null };
}
