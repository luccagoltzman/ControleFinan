import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useMemo } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { formatMoney } from '../../lib/money'
import { BRAZIL_MAP_CENTER } from '../../lib/regionMapAnchors'

export type SalesRegionMarker = {
  regionId: string
  name: string
  lat: number
  lng: number
  revenue: number
  profit: number
  qty: number
  orderCount: number
  usedFallbackAnchor: boolean
}

function leafletBounds(markers: SalesRegionMarker[]): L.LatLngBounds {
  if (markers.length === 0) {
    return L.latLngBounds(L.latLng(BRAZIL_MAP_CENTER[0] - 2, BRAZIL_MAP_CENTER[1] - 2), L.latLng(BRAZIL_MAP_CENTER[0] + 2, BRAZIL_MAP_CENTER[1] + 2))
  }
  if (markers.length === 1) {
    const { lat, lng } = markers[0]
    return L.latLngBounds(L.latLng(lat - 1.2, lng - 1.2), L.latLng(lat + 1.2, lng + 1.2))
  }
  return L.latLngBounds(markers.map((m) => L.latLng(m.lat, m.lng)))
}

export function SalesRegionMap({ markers }: { markers: SalesRegionMarker[] }) {
  const bounds = useMemo(() => leafletBounds(markers), [markers])
  const maxRev = useMemo(() => Math.max(...markers.map((m) => m.revenue), 1), [markers])

  if (markers.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Nenhuma venda com região no período filtrado. Associe uma região às vendas ou ajuste os filtros para ver o
        mapa.
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-[320px] flex-col">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [40, 40], maxZoom: 8 }}
        className="z-0 min-h-[320px] flex-1 w-full rounded-xl border border-border [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-control-attribution]:max-w-[min(100%,280px)]"
        style={{ minHeight: 320 }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {markers.map((m) => {
          const radius = 8 + 22 * Math.sqrt(m.revenue / maxRev)
          return (
            // react-leaflet v5: CircleMarker aceita radius (Leaflet); tipagem omit radius
            <CircleMarker
              key={m.regionId}
              center={[m.lat, m.lng]}
              pathOptions={{
                fillColor: '#1d4ed8',
                fillOpacity: 0.55,
                color: '#64748b',
                weight: 1,
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...({ radius } as any)}
            >
              <Popup>
                <div className="min-w-[190px] space-y-1 text-sm text-foreground">
                  <div className="font-semibold">{m.name}</div>
                  <div>
                    <span className="text-muted-foreground">Pedidos:</span> {m.orderCount}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Receita:</span> {formatMoney(m.revenue)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lucro:</span> {formatMoney(m.profit)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Volume (qtd):</span> {m.qty.toLocaleString('pt-BR')}
                  </div>
                  {m.usedFallbackAnchor ? (
                    <p className="border-t border-border pt-1 text-xs text-muted-foreground">
                      Posição estimada pelo nome da região. Na tela Regiões você pode informar latitude e longitude
                      exatas.
                    </p>
                  ) : null}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
      <p className="pointer-events-none absolute bottom-1 right-2 z-[500] rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm">
        © OpenStreetMap
      </p>
    </div>
  )
}
