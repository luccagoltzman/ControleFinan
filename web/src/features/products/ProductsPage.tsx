import { PageHeader } from '../../components/PageHeader'

export function ProductsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Cadastre produtos, custos e compare preço por markup e margem-alvo."
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Em implementação: CRUD de produtos, histórico de custos e regras de precificação.
      </div>
    </div>
  )
}

