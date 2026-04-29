const KEY = 'controlefinan.activeOrgId'

export function getStoredActiveOrgId() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setStoredActiveOrgId(value: string) {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // ignore
  }
}

