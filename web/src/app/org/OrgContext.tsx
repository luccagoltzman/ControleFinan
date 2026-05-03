import { createContext } from 'react'

export type OrgRole = 'owner' | 'admin' | 'member'

export type OrgSummary = {
  id: string
  name: string
  /** % sobre a receita do pedido (qtd × preço); opcional no cadastro */
  default_commission_percent: number | null
  /** Cor da marca (#RRGGBB); opcional */
  brand_color: string | null
  /** Caminho no bucket `org-assets` */
  logo_storage_path: string | null
  branding_updated_at: string
}

export type OrgMembership = {
  organization_id: string
  role: OrgRole
  organization: OrgSummary
}

export type OrgState = {
  isLoading: boolean
  memberships: OrgMembership[]
  activeOrgId: string | null
  /** Organização atualmente selecionada (para tema e logo); null se não houver id ativo */
  activeOrganization: OrgSummary | null
  setActiveOrgId: (orgId: string) => void
  refresh: () => Promise<void>
}

export const OrgContext = createContext<OrgState | undefined>(undefined)

