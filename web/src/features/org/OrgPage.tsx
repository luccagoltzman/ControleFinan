import { PageHeader } from '../../components/PageHeader'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { supabase } from '../../app/supabaseClient'
import { useOrg } from '../../app/org/useOrg'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Informe um nome'),
})

type CreateOrgValues = z.infer<typeof CreateOrgSchema>

export function OrgPage() {
  const { memberships, activeOrgId, setActiveOrgId, refresh, isLoading } = useOrg()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateOrgValues>({ resolver: zodResolver(CreateOrgSchema) })

  async function onCreateOrg(values: CreateOrgValues) {
    setErrorMsg(null)
    setIsCreating(true)
    try {
      const { data, error } = await supabase.rpc('create_organization_for_user', {
        org_name: values.name,
      })
      if (error) throw error
      if (typeof data === 'string') setActiveOrgId(data)
      reset()
      await refresh()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao criar organização')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organização"
        description="Gerencie a empresa/organização ativa e membros."
      />

      <section className="space-y-3">
        <div className="text-sm font-medium text-slate-800">Organização ativa</div>
        {isLoading ? (
          <div className="text-sm text-slate-600">Carregando…</div>
        ) : memberships.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Você ainda não tem uma organização. Crie uma abaixo para começar.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={activeOrgId ?? ''}
              onChange={(e) => setActiveOrgId(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.organization_id} value={m.organization_id}>
                  {m.organization.name} ({m.role})
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => refresh()}>
              Atualizar
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="text-sm font-medium text-slate-800">Criar nova organização</div>
        <form onSubmit={handleSubmit(onCreateOrg)} className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <Input placeholder="Ex.: Minha Empresa" {...register('name')} />
            {errors.name ? <div className="mt-1 text-xs text-rose-600">{errors.name.message}</div> : null}
          </div>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? 'Criando…' : 'Criar'}
          </Button>
        </form>
        {errorMsg ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMsg}
          </div>
        ) : null}
      </section>
    </div>
  )
}

