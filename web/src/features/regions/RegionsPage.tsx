import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { toast } from '../../components/toast/ToastHost'
import { useOrg } from '../../app/org/useOrg'
import { queryClient } from '../../app/queryClient'
import { createRegion, deleteRegion, fetchRegions } from './regionsApi'

const CreateRegionSchema = z.object({
  name: z.string().min(2, 'Informe um nome'),
})
type CreateRegionValues = z.infer<typeof CreateRegionSchema>

export function RegionsPage() {
  const { activeOrgId } = useOrg()

  const regionsQuery = useQuery({
    queryKey: ['regions', { org: activeOrgId }],
    queryFn: () => fetchRegions(activeOrgId!),
    enabled: !!activeOrgId,
  })

  const createMutation = useMutation({
    mutationFn: (values: CreateRegionValues) => createRegion({ organization_id: activeOrgId!, name: values.name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['regions'] })
      toast({ title: 'Região criada' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRegion({ organization_id: activeOrgId!, id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['regions'] })
      toast({ title: 'Região excluída' })
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRegionValues>({
    resolver: zodResolver(CreateRegionSchema),
  })

  async function onCreate(values: CreateRegionValues) {
    await createMutation.mutateAsync(values)
    reset({ name: '' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regiões"
        description="Cadastre regiões para segmentar suas vendas (ex.: Pará, Maranhão, Piauí)."
        right={
          <Dialog>
            <DialogTrigger asChild>
              <Button>Nova região</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova região</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onCreate)} className="grid gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input className="mt-1" placeholder="Ex.: Pará" {...register('name')} />
                  {errors.name ? <div className="mt-1 text-xs text-destructive">{errors.name.message}</div> : null}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    Salvar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent>
          {regionsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : regionsQuery.isError ? (
            <div className="text-sm text-destructive">Erro ao carregar regiões.</div>
          ) : (regionsQuery.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma região cadastrada.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {(regionsQuery.data ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="text-sm font-medium">{r.name}</div>
                  <Button variant="ghost" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}>
                    Excluir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

