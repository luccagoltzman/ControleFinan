import { PageHeader } from '../../components/PageHeader'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { supabase } from '../../app/supabaseClient'
import { useOrg } from '../../app/org/useOrg'
import { parseNumberPtBr } from '../../lib/number'
import { toast } from '../../components/toast/ToastHost'
import { useMutation } from '@tanstack/react-query'
import { queryClient } from '../../app/queryClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { getOrgLogoPublicUrl, orgLogoBucket } from '../../lib/orgBranding'
import { ImageIcon, Trash2, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'

const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Informe um nome'),
})

type CreateOrgValues = z.infer<typeof CreateOrgSchema>

const DEFAULT_PICKER_COLOR = '#475569'

function normalizeHexColor(raw: string): string | null {
  const s = raw.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s}`
  return null
}

export function OrgPage() {
  const { memberships, activeOrgId, activeOrganization, setActiveOrgId, refresh, isLoading } = useOrg()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [commissionDraft, setCommissionDraft] = useState('')
  const [orgCommissionError, setOrgCommissionError] = useState<string | null>(null)
  const [savingCommission, setSavingCommission] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [colorHexDraft, setColorHexDraft] = useState(DEFAULT_PICKER_COLOR)
  const [brandError, setBrandError] = useState<string | null>(null)
  const [savingBrandColor, setSavingBrandColor] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const m = memberships.find((x) => x.organization_id === activeOrgId)
    const v = m?.organization.default_commission_percent
    setCommissionDraft(v != null ? String(v).replace('.', ',') : '')
  }, [memberships, activeOrgId])

  useEffect(() => {
    const c = activeOrganization?.brand_color
    if (c && normalizeHexColor(c)) {
      setColorHexDraft(normalizeHexColor(c)!)
    } else {
      setColorHexDraft(DEFAULT_PICKER_COLOR)
    }
  }, [activeOrganization?.brand_color])

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

  const activeRole = memberships.find((m) => m.organization_id === activeOrgId)?.role ?? null

  const deleteOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase.rpc('delete_organization', { org_id: orgId })
      if (error) throw error
    },
    onSuccess: async () => {
      toast({ title: 'Organização excluída' })
      setDeleteOpen(false)
      setDeleteConfirmName('')
      setDeleteError(null)
      await queryClient.invalidateQueries({ queryKey: ['org'] })
      await refresh()
    },
  })

  async function onSaveBrandColor() {
    if (!activeOrgId) return
    setBrandError(null)
    setSavingBrandColor(true)
    try {
      const normalized = normalizeHexColor(colorHexDraft)
      if (!normalized) throw new Error('Cor inválida. Use formato #RRGGBB.')
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('organizations')
        .update({ brand_color: normalized, branding_updated_at: now })
        .eq('id', activeOrgId)
      if (error) throw error
      toast({ title: 'Cor da organização salva' })
      await refresh()
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSavingBrandColor(false)
    }
  }

  async function onClearBrandColor() {
    if (!activeOrgId) return
    setBrandError(null)
    setSavingBrandColor(true)
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('organizations')
        .update({ brand_color: null, branding_updated_at: now })
        .eq('id', activeOrgId)
      if (error) throw error
      setColorHexDraft(DEFAULT_PICKER_COLOR)
      toast({ title: 'Cor removida — voltando ao tema padrão' })
      await refresh()
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSavingBrandColor(false)
    }
  }

  async function onUploadLogo(file: File) {
    if (!activeOrgId || !activeOrganization) return
    setBrandError(null)
    setUploadingLogo(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        throw new Error('Use PNG, JPG ou WebP.')
      }
      if (file.size > 2 * 1024 * 1024) throw new Error('Arquivo maior que 2 MB.')

      const path = `${activeOrgId}/logo.${ext}`
      const prev = activeOrganization.logo_storage_path

      const { error: upErr } = await supabase.storage.from(orgLogoBucket).upload(path, file, {
        upsert: true,
        contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        cacheControl: '3600',
      })
      if (upErr) throw upErr

      if (prev && prev !== path) {
        await supabase.storage.from(orgLogoBucket).remove([prev])
      }

      const now = new Date().toISOString()
      const { error: dbErr } = await supabase
        .from('organizations')
        .update({ logo_storage_path: path, branding_updated_at: now })
        .eq('id', activeOrgId)
      if (dbErr) throw dbErr

      toast({ title: 'Logo atualizado' })
      await refresh()
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : 'Erro no envio do logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function onRemoveLogo() {
    if (!activeOrgId || !activeOrganization?.logo_storage_path) return
    setBrandError(null)
    setUploadingLogo(true)
    try {
      const path = activeOrganization.logo_storage_path
      await supabase.storage.from(orgLogoBucket).remove([path]).catch(() => undefined)
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('organizations')
        .update({ logo_storage_path: null, branding_updated_at: now })
        .eq('id', activeOrgId)
      if (error) throw error
      toast({ title: 'Logo removido' })
      await refresh()
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : 'Erro ao remover logo')
    } finally {
      setUploadingLogo(false)
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
            <CardTitle>Identidade visual</CardTitle>
            <CardDescription>
              Cor usada nos botões e destaques (tema), e logo no topo do sistema. Visível para todos os usuários desta
              organização.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 max-w-2xl">
            <div className="space-y-2">
              <Label>Cor da marca</Label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background"
                  value={normalizeHexColor(colorHexDraft) ?? DEFAULT_PICKER_COLOR}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setColorHexDraft(e.target.value)}
                  aria-label="Selecionar cor"
                />
                <Input
                  className="max-w-[140px] font-mono text-sm"
                  value={colorHexDraft}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setColorHexDraft(e.target.value)}
                  placeholder="#2563EB"
                  spellCheck={false}
                />
                <Button type="button" onClick={onSaveBrandColor} disabled={savingBrandColor}>
                  {savingBrandColor ? 'Salvando…' : 'Salvar cor'}
                </Button>
                <Button type="button" variant="outline" onClick={onClearBrandColor} disabled={savingBrandColor}>
                  Usar tema padrão
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cor atual no app: {activeOrganization?.brand_color ?? '(padrão ControleFinan)'}
              </p>
            </div>

            <div className="space-y-3 border-t border-border/60 pt-6">
              <div>
                <Label className="text-base">Logo</Label>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Aparece no topo junto ao nome da organização. Formatos: PNG, JPG ou WebP (máx. 2 MB). A imagem é
                  exibida inteira, sem cortar.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-muted/40 ring-1 ring-border/40">
                <div className="border-b border-border/60 bg-muted/30 px-4 py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pré-visualização</span>
                </div>
                <div className="flex min-h-[140px] items-center justify-center bg-gradient-to-b from-card to-muted/20 px-4 py-6 sm:min-h-[160px] sm:px-8 sm:py-8">
                  {activeOrganization?.logo_storage_path ? (
                    <img
                      src={
                        (getOrgLogoPublicUrl(activeOrganization.logo_storage_path) ?? '') +
                        `?v=${encodeURIComponent(activeOrganization.branding_updated_at)}`
                      }
                      alt=""
                      className="max-h-36 w-auto max-w-full object-contain object-center sm:max-h-40"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-muted-foreground/25 bg-background/80">
                        <ImageIcon className="h-7 w-7 text-muted-foreground/50" aria-hidden />
                      </div>
                      <p className="max-w-xs text-sm text-muted-foreground">
                        Nenhuma imagem ainda. Use o botão abaixo para enviar o arquivo da sua marca.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                disabled={uploadingLogo}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void onUploadLogo(f)
                }}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() => logoFileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" aria-hidden />
                  {uploadingLogo ? 'Enviando…' : activeOrganization?.logo_storage_path ? 'Trocar imagem' : 'Enviar imagem'}
                </Button>
                {activeOrganization?.logo_storage_path ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={uploadingLogo}
                    onClick={() => void onRemoveLogo()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                    Remover logo
                  </Button>
                ) : null}
              </div>
            </div>

            {brandError ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {brandError}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCommissionDraft(e.target.value)}
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

      {activeOrgId ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de risco</CardTitle>
            <CardDescription>
              Excluir uma organização remove também os dados associados (vendas, regiões, funcionários, etc.) via cascata no
              banco.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="font-medium">Organização ativa</div>
              <div className="mt-1 text-muted-foreground">{activeOrganization?.name ?? '—'}</div>
              <div className="mt-2 text-xs text-muted-foreground">Permissão atual: {activeRole ?? '—'}</div>
            </div>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={!activeOrgId || activeRole !== 'owner'}>
                  Excluir organização
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Excluir organização</DialogTitle>
                  <DialogDescription>
                    Esta ação é permanente. Para confirmar, digite exatamente o nome da organização ativa.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-2">
                  <Label>Confirmação (nome)</Label>
                  <Input
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder={activeOrganization?.name ?? 'Nome da organização'}
                  />
                  {deleteError ? <div className="text-sm text-destructive">{deleteError}</div> : null}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={
                      !activeOrgId ||
                      activeRole !== 'owner' ||
                      !activeOrganization?.name ||
                      deleteConfirmName.trim() !== activeOrganization.name ||
                      deleteOrgMutation.isPending
                    }
                    onClick={async () => {
                      if (!activeOrgId) return
                      setDeleteError(null)
                      try {
                        await deleteOrgMutation.mutateAsync(activeOrgId)
                        const next =
                          memberships.filter((m) => m.organization_id !== activeOrgId)[0]?.organization_id ?? null
                        if (next) setActiveOrgId(next)
                      } catch (e) {
                        setDeleteError(e instanceof Error ? e.message : 'Erro ao excluir organização')
                      }
                    }}
                  >
                    {deleteOrgMutation.isPending ? 'Excluindo…' : 'Excluir definitivamente'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {activeRole !== 'owner' ? (
              <div className="text-xs text-muted-foreground">
                Apenas o <span className="font-medium">owner</span> pode excluir uma organização.
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

