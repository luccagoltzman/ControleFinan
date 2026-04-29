import { PageHeader } from '../../components/PageHeader'

export function PayrollPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Folha salarial"
        description="Colaboradores, períodos mensais e lançamentos de proventos/descontos."
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Em implementação: colaboradores, períodos e totalização.
      </div>
    </div>
  )
}

