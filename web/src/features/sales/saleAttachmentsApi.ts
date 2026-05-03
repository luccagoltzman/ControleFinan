import { supabase } from '../../app/supabaseClient'

export type SaleAttachmentKind = 'nf' | 'customer_order'

export type SaleAttachment = {
  id: string
  organization_id: string
  sale_id: string
  kind: SaleAttachmentKind
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

const BUCKET = 'sale-attachments'
const MAX_BYTES = 50 * 1024 * 1024

const ALLOWED_EXT = new Set([
  'pdf',
  'xlsx',
  'xls',
  'csv',
  'xml',
  'doc',
  'docx',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'heic',
])

export function assertAttachmentFile(file: File) {
  if (file.size > MAX_BYTES) throw new Error('Arquivo muito grande (máx. 50 MB)')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXT.has(ext)) throw new Error(`Tipo não permitido (.${ext}). Use PDF, Excel, Word, XML, imagens…`)
}

export function sanitizeStorageFileName(name: string) {
  const base = name.replace(/[^\w.\-\u00C0-\u024F]/g, '_').replace(/_+/g, '_')
  return base.slice(0, 180) || 'arquivo'
}

export async function fetchSaleAttachments(input: {
  organizationId: string
  saleId: string
}): Promise<SaleAttachment[]> {
  const { data, error } = await supabase
    .from('sale_attachments')
    .select('id, organization_id, sale_id, kind, storage_path, file_name, mime_type, size_bytes, created_at')
    .eq('organization_id', input.organizationId)
    .eq('sale_id', input.saleId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string,
    organization_id: row.organization_id as string,
    sale_id: row.sale_id as string,
    kind: row.kind as SaleAttachmentKind,
    storage_path: row.storage_path as string,
    file_name: row.file_name as string,
    mime_type: (row.mime_type as string | null) ?? null,
    size_bytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    created_at: row.created_at as string,
  }))
}

export async function uploadSaleAttachment(input: {
  organizationId: string
  saleId: string
  kind: SaleAttachmentKind
  file: File
}) {
  assertAttachmentFile(input.file)
  const safe = sanitizeStorageFileName(input.file.name)
  const id = crypto.randomUUID()
  const storagePath = `${input.organizationId}/${input.saleId}/${id}_${safe}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, input.file, {
    cacheControl: '3600',
    upsert: false,
    contentType: input.file.type || undefined,
  })
  if (upErr) throw upErr

  const { error: insErr } = await supabase.from('sale_attachments').insert({
    organization_id: input.organizationId,
    sale_id: input.saleId,
    kind: input.kind,
    storage_path: storagePath,
    file_name: input.file.name,
    mime_type: input.file.type || null,
    size_bytes: input.file.size,
  })
  if (insErr) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw insErr
  }
}

export async function deleteSaleAttachment(input: {
  organizationId: string
  id: string
  storagePath: string
}) {
  const { error: stErr } = await supabase.storage.from(BUCKET).remove([input.storagePath])
  if (stErr) throw stErr

  const { error } = await supabase
    .from('sale_attachments')
    .delete()
    .eq('organization_id', input.organizationId)
    .eq('id', input.id)

  if (error) throw error
}

export async function getSaleAttachmentSignedUrl(storagePath: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export async function removeStoragePaths(paths: string[]) {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}
