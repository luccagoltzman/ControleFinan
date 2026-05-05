import type { OrgRole } from '../app/org/OrgContext'

/** Owner e admin podem aceder à folha, despesas avulsas e registo de auditoria. */
export function isPrivilegedOrgRole(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin'
}
