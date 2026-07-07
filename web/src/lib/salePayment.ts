import type { SalePaymentStatus } from '../features/sales/salesApi'

export const SALE_PAYMENT_LABELS: Record<SalePaymentStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
}

export function salePaymentBadgeClass(status: SalePaymentStatus): string {
  if (status === 'paid') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
  }
  return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
}
