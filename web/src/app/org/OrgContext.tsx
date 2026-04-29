import { createContext } from 'react'

export type OrgRole = 'owner' | 'admin' | 'member'

export type OrgSummary = {
  id: string
  name: string
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
  setActiveOrgId: (orgId: string) => void
  refresh: () => Promise<void>
}

export const OrgContext = createContext<OrgState | undefined>(undefined)

