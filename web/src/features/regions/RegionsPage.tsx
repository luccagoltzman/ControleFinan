import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { MapPin } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { toast } from '../../components/toast/ToastHost'
import { useOrg } from '../../app/org/useOrg'
import { queryClient } from '../../app/queryClient'
import { parseCoordNumber } from '../../lib/number'
import { suggestedAnchorForRegionName } from '../../lib/regionMapAnchors'
import { createRegion, deleteRegion, fetchRegions, type Region, updateRegionMap } from './regionsApi'

const CreateRegionSchema = z.object({
  name: z.string().min(2, 'Informe um nome'),
})
type CreateRegionValues = z.infer<typeof CreateRegionSchema>

export function RegionsPage() {
  const { activeOrgId } = useOrg()
  const [mapDialogRegion, setMapDialogRegion] = useState<Region | null>(null)
  const [mapLatDraft, setMapLatDraft] = useState('')
  const [mapLngDraft, setMapLngDraft] = useState('')
  const [mapFormError, setMapFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapDialogRegion) return
    setMapFormError(null)
    setMapLatDraft(mapDialogRegion.map_lat != null ? String(mapDialogRegion.map_lat).replace('.', ',') : '')
    setMapLngDraft(mapDialogRegion.map_lng != null ? String(mapDialogRegion.map_lng).replace('.', ',') : '')
  }, [mapDialogRegion])

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

  const updateMapMutation = useMutation({
    mutationFn: (input: { id: string; map_lat: number | null; map_lng: number | null }) =>
      updateRegionMap({ organization_id: activeOrgId!, id: input.id, map_lat: input.map_lat, map_lng: input.map_lng }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['regions'] })
      toast({ title: 'Posição no mapa salva' })
      setMapDialogRegion(null)
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

  function applySuggestedCoords() {
    if (!mapDialogRegion) return
    const sug = suggestedAnchorForRegionName(mapDialogRegion.name)
    if (!sug) {
      setMapFormError('Não há sugestão automática para este nome. Informe latitude e longitude manualmente.')
      return
    }
    setMapFormError(null)
    setMapLatDraft(String(sug[0]).replace('.', ','))
    setMapLngDraft(String(sug[1]).replace('.', ','))
  }

  async function onSaveMapCoords() {
    if (!mapDialogRegion || !activeOrgId) return
    setMapFormError(null)
    const latRaw = mapLatDraft.trim()
    const lngRaw = mapLngDraft.trim()
    if (!latRaw && !lngRaw) {
      try {
        await updateMapMutation.mutateAsync({ id: mapDialogRegion.id, map_lat: null, map_lng: null })
      } catch (e) {
        setMapFormError(e instanceof Error ? e.message : 'Erro ao salvar')
      }
      return
    }
    const lat = parseCoordNumber(latRaw)
    const lng = parseCoordNumber(lngRaw)
    if (lat == null || lng == null) {
      setMapFormError('Latitude e longitude inválidas. Use números (ex.: -1,45).')
      return
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setMapFormError('Latitude entre -90 e 90; longitude entre -180 e 180.')
      return
    }
    try {
      await updateMapMutation.mutateAsync({ id: mapDialogRegion.id, map_lat: lat, map_lng: lng })
    } catch (e) {
      setMapFormError(e instanceof Error ? e.message : 'Erro ao salvar')
    }
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
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.map_lat != null && r.map_lng != null
                        ? `Mapa: ${r.map_lat}, ${r.map_lng}`
                        : 'Mapa: sugestão por nome (ou defina coordenadas)'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setMapDialogRegion(r)}>
                      <MapPin className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Mapa
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}>
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!mapDialogRegion} onOpenChange={(open) => !open && setMapDialogRegion(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Posição no mapa — {mapDialogRegion?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Usado no dashboard. Se vazio, o sistema tenta posicionar pelo nome (ex.: estados). Você pode informar
              coordenadas exatas (Google Maps: clique com botão direito → copiar coordenadas).
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={applySuggestedCoords}>
              Preencher sugestão pelo nome
            </Button>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Latitude</Label>
                <Input
                  className="mt-1 font-mono text-sm"
                  value={mapLatDraft}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setMapLatDraft(e.target.value)}
                  placeholder="-1,4558"
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  className="mt-1 font-mono text-sm"
                  value={mapLngDraft}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setMapLngDraft(e.target.value)}
                  placeholder="-48,5044"
                />
              </div>
            </div>
            {mapFormError ? <div className="text-sm text-destructive">{mapFormError}</div> : null}
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={updateMapMutation.isPending}
              onClick={() => {
                if (!mapDialogRegion) return
                void updateMapMutation.mutateAsync({ id: mapDialogRegion.id, map_lat: null, map_lng: null })
              }}
            >
              Limpar coordenadas
            </Button>
            <Button type="button" onClick={() => void onSaveMapCoords()} disabled={updateMapMutation.isPending}>
              {updateMapMutation.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

