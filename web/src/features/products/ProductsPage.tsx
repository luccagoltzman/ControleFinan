import { PageHeader } from '../../components/PageHeader'
import { useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useOrg } from '../../app/org/useOrg'
import { queryClient } from '../../app/queryClient'
import { Button as ShButton } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { MoneyInput } from '../../components/inputs/MoneyInput'
import { Label } from '../../components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { toast } from '../../components/toast/ToastHost'
import { formatMoney, parseMoneyPtBr } from '../../lib/money'
import type { ChangeEvent } from 'react'
import {
  addCost,
  createProduct,
  fetchProducts,
  type QtyUnit,
  type Product,
  updateProduct,
  upsertProfitTarget,
} from './productsApi'

const CreateProductSchema = z.object({
  name: z.string().min(2, 'Informe um nome'),
  unit: z.string().min(1, 'Informe a unidade (ex.: kg)'),
  cost_kg: z.string().optional(),
  cost_un: z.string().optional(),
  target_profit_kg: z.string().optional(),
  target_profit_un: z.string().optional(),
})
type CreateProductValues = z.infer<typeof CreateProductSchema>

export function ProductsPage() {
  const { activeOrgId } = useOrg()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const productsQuery = useQuery({
    queryKey: ['products', { org: activeOrgId }],
    queryFn: () => fetchProducts(activeOrgId!),
    enabled: !!activeOrgId,
  })

  const createMutation = useMutation({
    mutationFn: (values: CreateProductValues) =>
      createProduct({ organization_id: activeOrgId!, name: values.name, unit: values.unit }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const addCostMutation = useMutation({
    mutationFn: (input: { product_id: string; unit: QtyUnit; cost: number; effective_date: string }) =>
      addCost({
        organization_id: activeOrgId!,
        product_id: input.product_id,
        unit: input.unit,
        cost: input.cost,
        effective_date: input.effective_date,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const targetMutation = useMutation({
    mutationFn: (input: { product_id: string; unit: QtyUnit; target_profit_amount: number }) =>
      upsertProfitTarget({
        organization_id: activeOrgId!,
        product_id: input.product_id,
        unit: input.unit,
        target_profit_amount: input.target_profit_amount,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductValues>({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: { unit: 'kg' },
  })

  async function onCreate(values: CreateProductValues) {
    setErrorMsg(null)
    try {
      const created = await createMutation.mutateAsync(values)

      const today = new Date().toISOString().slice(0, 10)
      const costKg = values.cost_kg?.trim() ? parseMoneyPtBr(values.cost_kg) : null
      const costUn = values.cost_un?.trim() ? parseMoneyPtBr(values.cost_un) : null
      const targetKg = values.target_profit_kg?.trim() ? parseMoneyPtBr(values.target_profit_kg) : null
      const targetUn = values.target_profit_un?.trim() ? parseMoneyPtBr(values.target_profit_un) : null

      if (values.cost_kg?.trim() && costKg == null) throw new Error('Custo kg inválido')
      if (values.cost_un?.trim() && costUn == null) throw new Error('Custo un inválido')
      if (values.target_profit_kg?.trim() && targetKg == null) throw new Error('Alvo kg inválido')
      if (values.target_profit_un?.trim() && targetUn == null) throw new Error('Alvo un inválido')

      if (costKg != null) {
        await addCostMutation.mutateAsync({ product_id: created.id, unit: 'kg', cost: costKg, effective_date: today })
      }
      if (costUn != null) {
        await addCostMutation.mutateAsync({ product_id: created.id, unit: 'un', cost: costUn, effective_date: today })
      }
      if (targetKg != null) {
        await targetMutation.mutateAsync({ product_id: created.id, unit: 'kg', target_profit_amount: targetKg })
      }
      if (targetUn != null) {
        await targetMutation.mutateAsync({ product_id: created.id, unit: 'un', target_profit_amount: targetUn })
      }

      reset({ name: '', unit: values.unit, cost_kg: '', cost_un: '', target_profit_kg: '', target_profit_un: '' })
      toast({ title: 'Produto criado e configurado' })
      setCreateOpen(false)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao criar produto')
    }
  }

  const products = productsQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Cadastre produtos, custos (kg/un) e alvo de lucro (kg/un). O preço de venda você digita na venda."
        right={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <ShButton>Novo produto</ShButton>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo produto</DialogTitle>
                <DialogDescription>
                  Cadastre o produto já completo (custos e alvo por kg/un). Você pode ajustar depois em “Editar”.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit(onCreate)} className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input className="mt-1" placeholder="Ex.: Camarão" {...register('name')} />
                  {errors.name ? <div className="mt-1 text-xs text-destructive">{errors.name.message}</div> : null}
                </div>
                <div>
                  <Label>Unidade (apenas referência)</Label>
                  <Input className="mt-1" placeholder="Ex.: kg" {...register('unit')} />
                  {errors.unit ? <div className="mt-1 text-xs text-destructive">{errors.unit.message}</div> : null}
                  <div className="mt-1 text-xs text-muted-foreground">
                    O sistema trabalha com custo/alvo por <b>kg</b> e <b>un</b>. Esse campo é só para exibição.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MoneyInput label="Custo (kg) (opcional)" {...register('cost_kg')} />
                  <MoneyInput label="Custo (un) (opcional)" {...register('cost_un')} />
                  <MoneyInput label="Alvo de lucro (kg) (opcional)" {...register('target_profit_kg')} />
                  <MoneyInput label="Alvo de lucro (un) (opcional)" {...register('target_profit_un')} />
                </div>

                {errorMsg ? <div className="text-sm text-destructive">{errorMsg}</div> : null}

                <DialogFooter>
                  <ShButton type="submit" disabled={isSubmitting}>
                    Criar produto
                  </ShButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {productsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando produtos…</div>
      ) : productsQuery.isError ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Erro ao carregar produtos.
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Nenhum produto cadastrado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} organizationId={activeOrgId!} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductCard({ product, organizationId }: { product: Product; organizationId: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const [costRaw, setCostRaw] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [targetKgRaw, setTargetKgRaw] = useState(() =>
    product.target_profit_kg != null ? String(product.target_profit_kg).replace('.', ',') : '',
  )
  const [targetUnRaw, setTargetUnRaw] = useState(() =>
    product.target_profit_un != null ? String(product.target_profit_un).replace('.', ',') : '',
  )

  const costKg = product.latest_cost_kg?.cost ?? null
  const costUn = product.latest_cost_un?.cost ?? null

  const updateProductMutation = useMutation({
    mutationFn: (input: { name: string; unit: string; weight_per_unit_kg: number | null; is_active: boolean }) =>
      updateProduct({ id: product.id, organization_id: organizationId, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({ title: 'Produto atualizado' })
    },
  })

  const addCostMutation = useMutation({
    mutationFn: (input: { cost: number; unit: QtyUnit; effective_date: string }) =>
      addCost({
        organization_id: organizationId,
        product_id: product.id,
        cost: input.cost,
        unit: input.unit,
        effective_date: input.effective_date,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({ title: 'Custo salvo' })
    },
  })

  const targetMutation = useMutation({
    mutationFn: (input: { unit: QtyUnit; target_profit_amount: number }) =>
      upsertProfitTarget({
        organization_id: organizationId,
        product_id: product.id,
        unit: input.unit,
        target_profit_amount: input.target_profit_amount,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({ title: 'Alvo de lucro salvo' })
    },
  })

  async function onSaveTarget(unit: QtyUnit) {
    setSaveError(null)
    const raw = unit === 'kg' ? targetKgRaw : targetUnRaw
    const n = parseMoneyPtBr(raw)
    if (n == null) return setSaveError('Alvo de lucro inválido')
    try {
      await targetMutation.mutateAsync({ unit, target_profit_amount: n })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar alvo')
    }
  }

  async function onSaveCost(unit: QtyUnit) {
    // usa o mesmo campo "Custo" mas fixa unit e data como hoje
    setSaveError(null)
    const raw = costRaw
    const n = parseMoneyPtBr(raw)
    if (n == null) return setSaveError('Custo inválido')
    try {
      await addCostMutation.mutateAsync({ cost: n, unit, effective_date: today })
      setCostRaw('')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar custo')
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{product.name}</div>
          <div className="mt-1 text-xs text-slate-600">
            Unidade: {product.unit} • Status: {product.is_active ? 'ativo' : 'inativo'}
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <ShButton variant="outline">Editar</ShButton>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Editar {product.name}</DialogTitle>
              <DialogDescription>
                Cadastre somente: <b>custo (kg/un)</b> e <b>alvo de lucro (kg/un)</b>. Na venda você digita o preço vendido.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="costs">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="costs">Custos</TabsTrigger>
                <TabsTrigger value="profit">Lucro</TabsTrigger>
                <TabsTrigger value="info">Produto</TabsTrigger>
              </TabsList>

              <TabsContent value="costs">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 text-sm font-semibold">kg → custo</div>
                    <div className="text-xs text-muted-foreground">Atual: {costKg != null ? formatMoney(costKg) : '—'}</div>
                    <div className="mt-3">
                      <MoneyInput label="Custo por kg" value={costRaw} onChange={(e) => setCostRaw(e.target.value)} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <ShButton variant="default" onClick={() => onSaveCost('kg')} disabled={addCostMutation.isPending}>
                        Salvar custo kg
                      </ShButton>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 text-sm font-semibold">un → custo</div>
                    <div className="text-xs text-muted-foreground">Atual: {costUn != null ? formatMoney(costUn) : '—'}</div>
                    <div className="mt-3">
                      <MoneyInput label="Custo por unidade" value={costRaw} onChange={(e) => setCostRaw(e.target.value)} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <ShButton variant="default" onClick={() => onSaveCost('un')} disabled={addCostMutation.isPending}>
                        Salvar custo un
                      </ShButton>
                    </div>
                  </div>
                </div>
                {saveError ? <div className="mt-3 text-sm text-destructive">{saveError}</div> : null}
              </TabsContent>

              <TabsContent value="profit">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 text-sm font-semibold">kg → alvo de lucro</div>
                    <MoneyInput
                      label="Quero ganhar (R$) por kg"
                      value={targetKgRaw}
                      onChange={(e) => setTargetKgRaw(e.target.value)}
                    />
                    <div className="mt-3">
                      <ShButton variant="default" onClick={() => onSaveTarget('kg')} disabled={targetMutation.isPending}>
                        Salvar alvo kg
                      </ShButton>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Atual: {product.target_profit_kg != null ? formatMoney(product.target_profit_kg) : '—'}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 text-sm font-semibold">un → alvo de lucro</div>
                    <MoneyInput
                      label="Quero ganhar (R$) por unidade"
                      value={targetUnRaw}
                      onChange={(e) => setTargetUnRaw(e.target.value)}
                    />
                    <div className="mt-3">
                      <ShButton variant="default" onClick={() => onSaveTarget('un')} disabled={targetMutation.isPending}>
                        Salvar alvo un
                      </ShButton>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Atual: {product.target_profit_un != null ? formatMoney(product.target_profit_un) : '—'}
                    </div>
                  </div>
                </div>
                {saveError ? <div className="mt-3 text-sm text-destructive">{saveError}</div> : null}
              </TabsContent>

              <TabsContent value="info">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="text-sm font-semibold">Dados do produto</div>
                    <div>
                      <Label className="text-muted-foreground">Nome</Label>
                      <Input
                        className="mt-1"
                        defaultValue={product.name}
                        onBlur={(e: ChangeEvent<HTMLInputElement>) =>
                          updateProductMutation.mutate({
                            name: e.target.value,
                            unit: product.unit,
                            weight_per_unit_kg: product.weight_per_unit_kg,
                            is_active: product.is_active,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Unidade “padrão” (apenas exibição)</Label>
                      <Input
                        className="mt-1"
                        defaultValue={product.unit}
                        onBlur={(e: ChangeEvent<HTMLInputElement>) =>
                          updateProductMutation.mutate({
                            name: product.name,
                            unit: e.target.value,
                            weight_per_unit_kg: product.weight_per_unit_kg,
                            is_active: product.is_active,
                          })
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        defaultChecked={product.is_active}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateProductMutation.mutate({
                            name: product.name,
                            unit: product.unit,
                            weight_per_unit_kg: product.weight_per_unit_kg,
                            is_active: e.target.checked,
                          })
                        }
                      />
                      Ativo
                    </label>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="text-sm font-semibold">Resumo</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      - Custo kg: <b className="text-foreground">{costKg != null ? formatMoney(costKg) : '—'}</b>
                      <br />
                      - Custo un: <b className="text-foreground">{costUn != null ? formatMoney(costUn) : '—'}</b>
                      <br />
                      - Alvo kg: <b className="text-foreground">{product.target_profit_kg != null ? formatMoney(product.target_profit_kg) : '—'}</b>
                      <br />
                      - Alvo un: <b className="text-foreground">{product.target_profit_un != null ? formatMoney(product.target_profit_un) : '—'}</b>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <div className="text-xs text-muted-foreground">
                As alterações são salvas conforme você clica em “Salvar” (preço/custo) ou sai do campo (produto).
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">Custo (último)</div>
          <div className="mt-1 text-sm text-slate-900">
            kg: {costKg != null ? formatMoney(costKg) : '—'} • un: {costUn != null ? formatMoney(costUn) : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {product.latest_cost_kg?.effective_date ?? product.latest_cost_un?.effective_date ?? ''}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">Preço (kg)</div>
          <div className="mt-1 text-sm text-slate-900">
            {product.sale_price_kg != null ? formatMoney(product.sale_price_kg) : '—'}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">Preço (un)</div>
          <div className="mt-1 text-sm text-slate-900">
            {product.sale_price_un != null ? formatMoney(product.sale_price_un) : '—'}
          </div>
        </div>
      </div>

    </div>
  )
}

