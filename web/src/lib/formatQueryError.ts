/** Mensagem legível para erros do Supabase/PostgREST (não são sempre instância de Error). */
export function formatQueryError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const o = err as { message?: string; details?: string; hint?: string; code?: string }
    const parts = [o.message, o.details, o.hint, o.code].filter(Boolean)
    if (parts.length) return parts.join(' — ')
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}
