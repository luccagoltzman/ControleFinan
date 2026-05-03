import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { startOfMonth, endOfMonth, format as formatDate } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Activity, DollarSign, Filter, Percent, PiggyBank, TrendingUp, Wallet } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '../../components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { formatMoney } from '../../lib/money'
import { useOrg } from '../../app/org/useOrg'
import { fetchProducts } from '../products/productsApi'
import { fetchSales } from '../sales/salesApi'

function monthRange(monthYYYYMM: string) {
  const [y, m] = monthYYYYMM.split('-').map(Number)
  const from = startOfMonth(new Date(y!, (m! - 1)!, 1))
  const to = endOfMonth(from)
  return { fromIso: new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0)).toISOString(), toIso: new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59)).toISOString() }
}

function formatShort(dateIso: string) {
  const d = new Date(dateIso)
  return formatDate(d, 'dd/MM', { locale: ptBR })
}

export function DashboardPage() {
  const { activeOrgId } = useOrg()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [unitFilter, setUnitFilter] = useState<'all' | 'kg' | 'un'>('all')
  const [productFilter, setProductFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')

  const { fromIso, toIso } = useMemo(() => monthRange(month), [month])

  const productsQuery = useQuery({
    queryKey: ['products', { org: activeOrgId }],
    queryFn: () => fetchProducts(activeOrgId!),
    enabled: !!activeOrgId,
  })

  const salesQuery = useQuery({
    queryKey: ['sales', { org: activeOrgId, month }],
    queryFn: () => fetchSales({ organizationId: activeOrgId!, fromIso, toIso }),
    enabled: !!activeOrgId,
  })

  const productsById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof productsQuery.data>[number]>()
    for (const p of productsQuery.data ?? []) map.set(p.id, p)
    return map
  }, [productsQuery.data])

  const filteredSales = useMemo(() => {
    let s = salesQuery.data ?? []
    if (unitFilter !== 'all') s = s.filter((x) => x.qty_unit === unitFilter)
    if (productFilter !== 'all') s = s.filter((x) => x.product_id === productFilter)
    if (regionFilter !== 'all') s = s.filter((x) => x.region_id === regionFilter)
    return s
  }, [salesQuery.data, unitFilter, productFilter, regionFilter])

  const totals = useMemo(() => {
    const revenue = filteredSales.reduce((acc, s) => acc + s.qty * s.unit_price, 0)
    const cost = filteredSales.reduce((acc, s) => acc + s.qty * s.unit_cost_snapshot, 0)
    const profit = revenue - cost
    const margin = revenue > 0 ? profit / revenue : 0

    // alvo
    let targetTotal = 0
    let withTarget = 0
    let hitTarget = 0
    for (const sale of filteredSales) {
      const p = productsById.get(sale.product_id)
      const targetPerUnit = sale.qty_unit === 'kg' ? p?.target_profit_kg ?? null : p?.target_profit_un ?? null
      if (targetPerUnit == null) continue
      withTarget += 1
      const t = sale.qty * targetPerUnit
      targetTotal += t
      const saleProfit = sale.qty * (sale.unit_price - sale.unit_cost_snapshot)
      if (saleProfit >= t) hitTarget += 1
    }

    const commissionTotal = filteredSales.reduce((acc, s) => acc + s.commission_amount, 0)

    return { revenue, cost, profit, margin, targetTotal, withTarget, hitTarget, commissionTotal }
  }, [filteredSales, productsById])

  const daily = useMemo(() => {
    const byDay = new Map<string, { revenue: number; cost: number; profit: number }>()
    for (const s of filteredSales) {
      const day = new Date(s.sold_at).toISOString().slice(0, 10)
      const row = byDay.get(day) ?? { revenue: 0, cost: 0, profit: 0 }
      const rev = s.qty * s.unit_price
      const c = s.qty * s.unit_cost_snapshot
      row.revenue += rev
      row.cost += c
      row.profit += rev - c
      byDay.set(day, row)
    }

    const [y, mo] = month.split('-').map(Number)
    const lastDay = new Date(Date.UTC(y!, mo!, 0)).getUTCDate()
    const out: Array<{ day: string; label: string; dayNum: number; revenue: number; cost: number; profit: number }> = []
    for (let d = 1; d <= lastDay; d++) {
      const day = new Date(Date.UTC(y!, mo! - 1, d)).toISOString().slice(0, 10)
      const agg = byDay.get(day) ?? { revenue: 0, cost: 0, profit: 0 }
      out.push({
        day,
        label: formatShort(day),
        dayNum: d,
        ...agg,
      })
    }
    return out
  }, [filteredSales, month])

  const byProduct = useMemo(() => {
    const by = new Map<string, { productId: string; name: string; revenue: number; profit: number; margin: number }>()
    for (const s of filteredSales) {
      const name = s.product?.name ?? productsById.get(s.product_id)?.name ?? 'Produto'
      const row = by.get(s.product_id) ?? { productId: s.product_id, name, revenue: 0, profit: 0, margin: 0 }
      const rev = s.qty * s.unit_price
      const c = s.qty * s.unit_cost_snapshot
      row.revenue += rev
      row.profit += rev - c
      by.set(s.product_id, row)
    }
    const arr = [...by.values()]
    for (const r of arr) r.margin = r.revenue > 0 ? r.profit / r.revenue : 0
    return arr.sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [filteredSales, productsById])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral de vendas, custo, lucro e atingimento de alvo."
        right={
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Mês</div>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[170px]" />
            </label>
          </div>
        }
      />

      <Card className="border-border/60 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros (slicers)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <Label>Produto</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background/80 px-3 text-sm shadow-sm"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              {(productsQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>Unidade</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background/80 px-3 text-sm shadow-sm"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value as any)}
            >
              <option value="all">Todas</option>
              <option value="kg">kg</option>
              <option value="un">un</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <Label>Região</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background/80 px-3 text-sm shadow-sm"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              <option value="all">Todas</option>
              {Array.from(
                new Map((salesQuery.data ?? []).map((s) => [s.region_id ?? 'none', s.region?.name ?? 'Sem região'])).entries(),
              )
                .filter(([id]) => id !== 'none')
                .map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
            </select>
          </div>
          <div className="md:col-span-6 flex items-center">
            <div className="text-xs text-muted-foreground">
              Dica: combine filtros para comparar resultados, como no Power BI.
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Kpi
          title="Receita"
          value={formatMoney(totals.revenue)}
          icon={<DollarSign className="h-4 w-4" />}
          accent="primary"
        />
        <Kpi title="Custo" value={formatMoney(totals.cost)} icon={<PiggyBank className="h-4 w-4" />} accent="muted" />
        <Kpi title="Lucro" value={formatMoney(totals.profit)} icon={<TrendingUp className="h-4 w-4" />} accent="good" />
        <Kpi title="Margem" value={`${(totals.margin * 100).toFixed(2)}%`} icon={<Percent className="h-4 w-4" />} accent="muted" />
        <Kpi
          title="Comissão"
          value={formatMoney(totals.commissionTotal)}
          subtitle="Sobre receita do pedido"
          icon={<Wallet className="h-4 w-4" />}
          accent="primary"
        />
        <Kpi
          title="Alvo (total)"
          value={totals.withTarget > 0 ? formatMoney(totals.targetTotal) : '—'}
          subtitle={totals.withTarget > 0 ? `${totals.hitTarget}/${totals.withTarget} vendas atingiram` : 'Sem alvo cadastrado'}
          icon={<Activity className="h-4 w-4" />}
          accent={totals.withTarget > 0 ? (totals.hitTarget / totals.withTarget >= 0.5 ? 'good' : 'warn') : 'muted'}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-7 border-border/60 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>Tendência do mês</span>
              <span className="text-xs font-medium text-muted-foreground">
                {daily.length} dias • {filteredSales.length} vendas filtradas
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ left: 12, right: 16, top: 16, bottom: 28 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="profit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                <XAxis
                  dataKey="dayNum"
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Dia do mês', position: 'insideBottom', offset: -4, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  interval={0}
                  minTickGap={6}
                />
                <YAxis tickFormatter={(v) => `R$ ${Number(v).toFixed(0)}`} width={78} />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { day?: string; label?: string } | undefined
                    return p?.label ?? p?.day ?? ''
                  }}
                  formatter={(v: any) => formatMoney(Number(v))}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--background))',
                  }}
                />
                <Legend />
                <Area
                  type="linear"
                  dataKey="revenue"
                  name="Receita"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#rev)"
                  dot={{ r: 3.5, strokeWidth: 2, stroke: 'hsl(var(--primary))', fill: 'hsl(var(--background))' }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Area
                  type="linear"
                  dataKey="profit"
                  name="Lucro"
                  stroke="hsl(142 76% 36%)"
                  strokeWidth={2}
                  fill="url(#profit)"
                  dot={{ r: 3.5, strokeWidth: 2, stroke: 'hsl(142 76% 36%)', fill: 'hsl(var(--background))' }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5 border-border/60 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50">
          <CardHeader className="pb-3">
            <CardTitle>Receita por produto (Top 8)</CardTitle>
          </CardHeader>
          <CardContent className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProduct} margin={{ left: 12, right: 16, top: 16, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                <XAxis dataKey="name" tickMargin={8} hide />
                <YAxis tickFormatter={(v) => `R$ ${Number(v).toFixed(0)}`} width={78} />
                <Tooltip
                  formatter={(v: any, name: any) => {
                    if (name === 'margin') return `${(Number(v) * 100).toFixed(2)}%`
                    return formatMoney(Number(v))
                  }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--background))',
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Receita" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" name="Lucro" fill="hsl(142 76% 36%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-12 border-border/60 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50">
          <CardHeader className="pb-3">
            <CardTitle>Tabela (modo Power BI)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border border-border">
              <table className="min-w-[1020px] w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="p-2">Data</th>
                    <th className="p-2">Produto</th>
                    <th className="p-2">Un</th>
                    <th className="p-2 text-right">Qtd</th>
                    <th className="p-2 text-right">Preço</th>
                    <th className="p-2 text-right">Custo</th>
                    <th className="p-2 text-right">Lucro</th>
                    <th className="p-2 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.slice(0, 40).map((s) => {
                    const profit = s.qty * (s.unit_price - s.unit_cost_snapshot)
                    return (
                      <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-2">{new Date(s.sold_at).toISOString().slice(0, 10)}</td>
                        <td className="p-2">{s.product?.name ?? productsById.get(s.product_id)?.name ?? 'Produto'}</td>
                        <td className="p-2">{s.qty_unit}</td>
                        <td className="p-2 text-right">{s.qty}</td>
                        <td className="p-2 text-right">{formatMoney(s.unit_price)}</td>
                        <td className="p-2 text-right">{formatMoney(s.unit_cost_snapshot)}</td>
                        <td className="p-2 text-right">{formatMoney(profit)}</td>
                        <td className="p-2 text-right">{formatMoney(s.commission_amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Mostrando até 40 linhas (pra não pesar). Se quiser, eu coloco paginação e export CSV.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function Kpi({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  accent: 'primary' | 'good' | 'warn' | 'muted'
}) {
  const accentClass =
    accent === 'primary'
      ? 'bg-primary/10 text-primary'
      : accent === 'good'
        ? 'bg-emerald-500/10 text-emerald-700'
        : accent === 'warn'
          ? 'bg-amber-500/10 text-amber-700'
          : 'bg-muted text-muted-foreground'
  return (
    <Card className="border-border/60 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <span>{title}</span>
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${accentClass}`}>{icon}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <div className="text-[22px] leading-tight md:text-2xl font-semibold tracking-tight truncate">{value}</div>
        {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
      </CardContent>
    </Card>
  )
}

