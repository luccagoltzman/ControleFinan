import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { useMemo } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { useOrg } from '../../app/org/useOrg'
import { fetchAuditLogs, type AuditLogRow } from './auditLogsApi'

const ENTITY_PT: Record<string, string> = {
  organizations: 'Organização',
  organization_members: 'Membro da equipe',
  products: 'Produto',
  product_costs: 'Custo de produto',
  product_pricing_rules: 'Regra de preço',
  product_sale_prices: 'Preço de venda',
  product_profit_targets: 'Alvo de lucro',
  employees: 'Colaborador',
  payroll_periods: 'Período da folha',
  payroll_entries: 'Lançamento da folha',
  payroll_employee_payments: 'Pagamento na folha',
  misc_expenses: 'Despesa avulsa',
  sales: 'Venda',
  regions: 'Região',
  sale_attachments: 'Anexo de venda',
}

function summarizeAction(action: string): string {
  const dot = action.indexOf('.')
  if (dot < 0) return action
  const op = action.slice(0, dot)
  const table = action.slice(dot + 1)
  const opPt = op === 'insert' ? 'Criação' : op === 'update' ? 'Alteração' : op === 'delete' ? 'Exclusão' : op
  const ent = ENTITY_PT[table] ?? table.replaceAll('_', ' ')
  return `${opPt} — ${ent}`
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function AuditLogsPage() {
  const { activeOrgId } = useOrg()

  const logsQuery = useQuery({
    queryKey: ['audit-logs', { org: activeOrgId }],
    queryFn: () => fetchAuditLogs({ organizationId: activeOrgId!, limit: 200, offset: 0 }),
    enabled: !!activeOrgId,
  })

  const rows = logsQuery.data ?? []

  const empty = !logsQuery.isLoading && rows.length === 0

  const errorText = useMemo(() => {
    if (!logsQuery.error) return null
    return logsQuery.error instanceof Error ? logsQuery.error.message : 'Erro ao carregar o registro.'
  }, [logsQuery.error])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de atividades"
        description="Histórico de alterações na organização (quem fez o quê). Visível apenas para administradores."
        right={
          <Button type="button" variant="outline" size="sm" onClick={() => logsQuery.refetch()} disabled={logsQuery.isFetching}>
            Atualizar
          </Button>
        }
      />

      {logsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : errorText ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorText}
        </div>
      ) : empty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 opacity-60" aria-hidden />
            <p className="text-sm">Ainda não há eventos registados nesta organização.</p>
            <p className="max-w-md text-xs">As próximas criações, alterações ou exclusões de dados aparecerão aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-medium">Quando</th>
                <th className="px-3 py-2 font-medium">Quem</th>
                <th className="px-3 py-2 font-medium">Ação</th>
                <th className="px-3 py-2 font-medium">Registo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: AuditLogRow) => (
                <tr key={row.id} className="border-b border-border/80 last:border-0 hover:bg-muted/30">
                  <td className="whitespace-nowrap px-3 py-2 align-top text-muted-foreground">{formatWhen(row.created_at)}</td>
                  <td className="max-w-[200px] break-all px-3 py-2 align-top">
                    {row.actor_email ?? (row.user_id ? `id: ${row.user_id.slice(0, 8)}…` : '—')}
                  </td>
                  <td className="px-3 py-2 align-top">{summarizeAction(row.action)}</td>
                  <td className="break-all px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                    {row.entity_type}
                    {row.entity_id ? ` · ${row.entity_id}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
