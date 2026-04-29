import { PageHeader } from '../../components/PageHeader'
import { useMutation, useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useOrg } from '../../app/org/useOrg'
import { queryClient } from '../../app/queryClient'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { MoneyInput } from '../../components/inputs/MoneyInput'
import { PercentInput } from '../../components/inputs/PercentInput'
import { formatMoney, parseMoneyPtBr } from '../../lib/money'
import { parsePercentTo01 } from '../../lib/percent'
import {
  addCost,
  createProduct,
  fetchProducts,
  type PricingMode,
  type Product,
  updateProduct,
  upsertPricingRule,
} from './productsApi'
import { calcSalePriceByMarkup, calcSalePriceByTargetMargin } from './pricing'

const CreateProductSchema = z.object({
  name: z.string().min(2, 'Informe um nome'),
  unit: z.string().min(1, 'Informe a unidade (ex.: kg)'),
})
type CreateProductValues = z.infer<typeof CreateProductSchema>

export function ProductsPage() {
  const { activeOrgId } = useOrg()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
      await createMutation.mutateAsync(values)
      reset({ name: '', unit: values.unit })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao criar produto')
    }
  }

  const products = productsQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Cadastre produtos, custos e compare preço por markup e margem-alvo."
      />

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-medium text-slate-800">Novo produto</div>
        <form onSubmit={handleSubmit(onCreate)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input placeholder="Ex.: Tilápia" {...register('name')} />
            {errors.name ? <div className="mt-1 text-xs text-rose-600">{errors.name.message}</div> : null}
          </div>
          <div>
            <Input placeholder="Unidade (ex.: kg)" {...register('unit')} />
            {errors.unit ? <div className="mt-1 text-xs text-rose-600">{errors.unit.message}</div> : null}
          </div>
          <div className="sm:col-span-3 flex items-center gap-2">
            <Button type="submit" disabled={isSubmitting}>
              Adicionar
            </Button>
            {errorMsg ? <div className="text-sm text-rose-700">{errorMsg}</div> : null}
          </div>
        </form>
      </section>

      {productsQuery.isLoading ? (
        <div className="text-sm text-slate-600">Carregando produtos…</div>
      ) : productsQuery.isError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Erro ao carregar produtos.
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
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
  const [isEditing, setIsEditing] = useState(false)
  const [costRaw, setCostRaw] = useState('')
  const [costDate, setCostDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [mode, setMode] = useState<PricingMode>(product.pricing_rule?.mode ?? 'both')
  const [markupRaw, setMarkupRaw] = useState(() =>
    product.pricing_rule?.markup_percent != null ? String(product.pricing_rule.markup_percent * 100) : '',
  )
  const [marginRaw, setMarginRaw] = useState(() =>
    product.pricing_rule?.target_margin_percent != null ? String(product.pricing_rule.target_margin_percent * 100) : '',
  )
  const [saveError, setSaveError] = useState<string | null>(null)

  const latestCost = product.latest_cost?.cost ?? null
  const markup01 = useMemo(() => (markupRaw ? parsePercentTo01(markupRaw) : null), [markupRaw])
  const margin01 = useMemo(() => (marginRaw ? parsePercentTo01(marginRaw) : null), [marginRaw])

  const saleByMarkup =
    latestCost != null && markup01 != null ? calcSalePriceByMarkup(latestCost, markup01) : null
  const saleByMargin =
    latestCost != null && margin01 != null ? calcSalePriceByTargetMargin(latestCost, margin01) : null

  const updateProductMutation = useMutation({
    mutationFn: (input: { name: string; unit: string; is_active: boolean }) =>
      updateProduct({ id: product.id, organization_id: organizationId, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const addCostMutation = useMutation({
    mutationFn: (input: { cost: number; effective_date: string }) =>
      addCost({
        organization_id: organizationId,
        product_id: product.id,
        cost: input.cost,
        effective_date: input.effective_date,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const pricingMutation = useMutation({
    mutationFn: (input: {
      mode: PricingMode
      markup_percent: number | null
      target_margin_percent: number | null
    }) =>
      upsertPricingRule({
        organization_id: organizationId,
        product_id: product.id,
        ...input,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  async function onSavePricing() {
    setSaveError(null)
    try {
      const markup = markupRaw ? parsePercentTo01(markupRaw) : null
      const margin = marginRaw ? parsePercentTo01(marginRaw) : null
      await pricingMutation.mutateAsync({
        mode,
        markup_percent: markup,
        target_margin_percent: margin,
      })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar regra')
    }
  }

  async function onAddCost() {
    setSaveError(null)
    const n = parseMoneyPtBr(costRaw)
    if (n == null) {
      setSaveError('Custo inválido')
      return
    }
    try {
      await addCostMutation.mutateAsync({ cost: n, effective_date: costDate })
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
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setIsEditing((v) => !v)}>
            {isEditing ? 'Fechar' : 'Editar'}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">Custo (último)</div>
          <div className="mt-1 text-sm text-slate-900">
            {latestCost != null ? formatMoney(latestCost) : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {product.latest_cost?.effective_date ?? ''}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">Preço por markup</div>
          <div className="mt-1 text-sm text-slate-900">{saleByMarkup != null ? formatMoney(saleByMarkup) : '—'}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">Preço por margem-alvo</div>
          <div className="mt-1 text-sm text-slate-900">{saleByMargin != null ? formatMoney(saleByMargin) : '—'}</div>
          {saleByMargin == null && margin01 != null ? (
            <div className="mt-1 text-xs text-amber-700">Margem inválida (≥ 100%)</div>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-800">Produto</div>
            <label className="block">
              <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
              <Input
                defaultValue={product.name}
                onBlur={(e) =>
                  updateProductMutation.mutate({
                    name: e.target.value,
                    unit: product.unit,
                    is_active: product.is_active,
                  })
                }
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm font-medium text-slate-700">Unidade</div>
              <Input
                defaultValue={product.unit}
                onBlur={(e) =>
                  updateProductMutation.mutate({
                    name: product.name,
                    unit: e.target.value,
                    is_active: product.is_active,
                  })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                defaultChecked={product.is_active}
                onChange={(e) =>
                  updateProductMutation.mutate({
                    name: product.name,
                    unit: product.unit,
                    is_active: e.target.checked,
                  })
                }
              />
              Ativo
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-800">Novo custo</div>
            <MoneyInput label="Custo" value={costRaw} onChange={(e) => setCostRaw(e.target.value)} />
            <label className="block">
              <div className="mb-1 text-sm font-medium text-slate-700">Data</div>
              <Input type="date" value={costDate} onChange={(e) => setCostDate(e.target.value)} />
            </label>
            <Button variant="secondary" onClick={onAddCost} disabled={addCostMutation.isPending}>
              Salvar custo
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-800">Regra de preço</div>
            <label className="block">
              <div className="mb-1 text-sm font-medium text-slate-700">Modo</div>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as PricingMode)}
              >
                <option value="both">Comparar (markup e margem)</option>
                <option value="markup">Somente markup</option>
                <option value="target_margin">Somente margem-alvo</option>
              </select>
            </label>
            <PercentInput
              label="Markup (%)"
              value={markupRaw}
              onChange={(e) => setMarkupRaw(e.target.value)}
              disabled={mode === 'target_margin'}
            />
            <PercentInput
              label="Margem-alvo (%)"
              value={marginRaw}
              onChange={(e) => setMarginRaw(e.target.value)}
              disabled={mode === 'markup'}
            />
            <Button variant="secondary" onClick={onSavePricing} disabled={pricingMutation.isPending}>
              Salvar regra
            </Button>
            {saveError ? <div className="text-sm text-rose-700">{saveError}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

