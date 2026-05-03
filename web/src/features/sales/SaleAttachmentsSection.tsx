import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { Paperclip } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { toast } from '../../components/toast/ToastHost'
import { queryClient } from '../../app/queryClient'
import {
  deleteSaleAttachment,
  fetchSaleAttachments,
  getSaleAttachmentSignedUrl,
  uploadSaleAttachment,
  type SaleAttachmentKind,
} from './saleAttachmentsApi'

function formatBytes(n: number | null) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function SaleAttachmentsSection({
  organizationId,
  saleId,
}: {
  organizationId: string
  saleId: string
}) {
  const nfRef = useRef<HTMLInputElement>(null)
  const pedidoRef = useRef<HTMLInputElement>(null)

  const attachmentsQuery = useQuery({
    queryKey: ['sale-attachments', { org: organizationId, sale: saleId }],
    queryFn: () => fetchSaleAttachments({ organizationId, saleId }),
  })

  const uploadMutation = useMutation({
    mutationFn: (input: { kind: SaleAttachmentKind; file: File }) =>
      uploadSaleAttachment({ organizationId, saleId, kind: input.kind, file: input.file }),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['sale-attachments', { org: organizationId, sale: saleId }] })
      toast({
        title: 'Arquivo enviado',
        description: vars.kind === 'nf' ? 'Nota fiscal anexada.' : 'Pedido do cliente anexado.',
      })
    },
    onError: (err) => {
      toast({
        title: 'Erro ao enviar',
        description: err instanceof Error ? err.message : 'Falha no upload',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (input: { id: string; storagePath: string }) =>
      deleteSaleAttachment({ organizationId, id: input.id, storagePath: input.storagePath }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sale-attachments', { org: organizationId, sale: saleId }] })
      toast({ title: 'Arquivo removido' })
    },
  })

  async function onPick(kind: SaleAttachmentKind, files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    await uploadMutation.mutateAsync({ kind, file })
    if (kind === 'nf' && nfRef.current) nfRef.current.value = ''
    if (kind === 'customer_order' && pedidoRef.current) pedidoRef.current.value = ''
  }

  async function onDownload(path: string, fileName: string) {
    try {
      const url = await getSaleAttachmentSignedUrl(path)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      toast({
        title: 'Erro ao baixar',
        description: err instanceof Error ? err.message : 'Não foi possível gerar o link',
      })
    }
  }

  const nfList = (attachmentsQuery.data ?? []).filter((a) => a.kind === 'nf')
  const pedidoList = (attachmentsQuery.data ?? []).filter((a) => a.kind === 'customer_order')

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <Paperclip className="h-4 w-4" />
        Documentos do pedido
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Envie PDF, Excel, Word, XML ou imagens (PNG/JPG etc.). Máximo 50 MB por arquivo.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Nota fiscal (NF)</Label>
          <input
            ref={nfRef}
            type="file"
            className="hidden"
            accept=".pdf,.xml,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.heic"
            onChange={(e) => void onPick('nf', e.target.files)}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => nfRef.current?.click()} disabled={uploadMutation.isPending}>
            Anexar NF
          </Button>
          <ul className="space-y-1 text-xs">
            {nfList.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1">
                <button
                  type="button"
                  className="truncate text-left font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => void onDownload(a.storage_path, a.file_name)}
                >
                  {a.file_name}
                </button>
                <span className="text-muted-foreground">{formatBytes(a.size_bytes)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive"
                  onClick={() => deleteMutation.mutate({ id: a.id, storagePath: a.storage_path })}
                  disabled={deleteMutation.isPending}
                >
                  Remover
                </Button>
              </li>
            ))}
            {nfList.length === 0 ? <li className="text-muted-foreground">Nenhuma NF anexada.</li> : null}
          </ul>
        </div>

        <div className="space-y-2">
          <Label>Pedido / imagem do cliente</Label>
          <input
            ref={pedidoRef}
            type="file"
            className="hidden"
            accept=".pdf,.xml,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.heic"
            onChange={(e) => void onPick('customer_order', e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => pedidoRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            Anexar pedido
          </Button>
          <ul className="space-y-1 text-xs">
            {pedidoList.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1">
                <button
                  type="button"
                  className="truncate text-left font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => void onDownload(a.storage_path, a.file_name)}
                >
                  {a.file_name}
                </button>
                <span className="text-muted-foreground">{formatBytes(a.size_bytes)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive"
                  onClick={() => deleteMutation.mutate({ id: a.id, storagePath: a.storage_path })}
                  disabled={deleteMutation.isPending}
                >
                  Remover
                </Button>
              </li>
            ))}
            {pedidoList.length === 0 ? <li className="text-muted-foreground">Nenhum pedido anexado.</li> : null}
          </ul>
        </div>
      </div>

      {attachmentsQuery.isLoading ? <div className="mt-2 text-xs text-muted-foreground">Carregando anexos…</div> : null}
      {attachmentsQuery.isError ? <div className="mt-2 text-xs text-destructive">Erro ao carregar anexos.</div> : null}
    </div>
  )
}
