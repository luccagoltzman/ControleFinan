import { PageHeader } from '../../components/PageHeader'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { supabase } from '../../app/supabaseClient'
import { useOrg } from '../../app/org/useOrg'
import { parseNumberPtBr } from '../../lib/number'
import { toast } from '../../components/toast/ToastHost'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'

const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Informe um nome'),
})

type CreateOrgValues = z.infer<typeof CreateOrgSchema>

export function OrgPage() {
  const { memberships, activeOrgId, setActiveOrgId, refresh, isLoading } = useOrg()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [commissionDraft, setCommissionDraft] = useState('')
  const [orgCommissionError, setOrgCommissionError] = useState<string | null>(null)
  const [savingCommission, setSavingCommission] = useState(false)

  useEffect(() => {
    const m = memberships.find((x) => x.organization_id === activeOrgId)
    const v = m?.organization.default_commission_percent
    setCommissionDraft(v != null ? String(v).replace('.', ',') : '')
  }, [memberships, activeOrgId])

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

  async function onSaveOrgCommission() {
    if (!activeOrgId) return
    setOrgCommissionError(null)
    setSavingCommission(true)
    try {
      const raw = commissionDraft.trim()
      let value: number | null = null
      if (raw) {
        const n = parseNumberPtBr(raw)
        if (n == null) throw new Error('Percentual inválido')
        if (n < 0 || n > 100) throw new Error('Use um valor entre 0 e 100')
        value = n
      }
      const { error } = await supabase
        .from('organizations')
        .update({ default_commission_percent: value })
        .eq('id', activeOrgId)
      if (error) throw error
      toast({ title: 'Comissão padrão salva' })
      await refresh()
    } catch (err) {
      setOrgCommissionError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSavingCommission(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organização"
        description="Gerencie a empresa/organização ativa e membros."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organização ativa</CardTitle>
            <CardDescription>Escolha qual empresa está usando agora.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando…</div>
            ) : memberships.length === 0 ? (
              <div className="rounded-md border border-border bg-muted px-3 py-3 text-sm">
                Você ainda não tem uma organização. Crie ao lado para começar.
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm md:w-auto"
                  value={activeOrgId ?? ''}
                  onChange={(e) => setActiveOrgId(e.target.value)}
                >
                  {memberships.map((m) => (
                    <option key={m.organization_id} value={m.organization_id}>
                      {m.organization.name} ({m.role})
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => refresh()}>
                  Atualizar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Criar nova organização</CardTitle>
            <CardDescription>Crie uma empresa para começar a cadastrar dados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSubmit(onCreateOrg)} className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <Input placeholder="Ex.: Minha Empresa" {...register('name')} />
                {errors.name ? (
                  <div className="mt-1 text-xs text-destructive">{errors.name.message}</div>
                ) : null}
              </div>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Criando…' : 'Criar'}
              </Button>
            </form>
            {errorMsg ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {activeOrgId ? (
        <Card>
          <CardHeader>
            <CardTitle>Comissão do representante</CardTitle>
            <CardDescription>
              Percentual sobre o valor total de cada pedido (quantidade × preço de venda). Você pode definir um valor
              diferente por produto na edição do produto.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-md space-y-3">
            <div>
              <div className="text-sm font-medium">% padrão da organização</div>
              <Input
                className="mt-1"
                placeholder="Ex.: 3,5 ou vazio"
                value={commissionDraft}
                onChange={(e) => setCommissionDraft(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Deixe vazio se não houver comissão sobre o pedido (ou cadastre depois). Produtos podem ter um % próprio.
              </p>
            </div>
            {orgCommissionError ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {orgCommissionError}
              </div>
            ) : null}
            <Button type="button" onClick={onSaveOrgCommission} disabled={savingCommission}>
              {savingCommission ? 'Salvando…' : 'Salvar comissão padrão'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

