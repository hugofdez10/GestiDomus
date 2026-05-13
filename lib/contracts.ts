export type ContractLike = {
  id?: string | number
  property_id?: number | string | null
  tenant_id?: number | string | null
  contract_status?: string | null
  start_date?: string | null
  end_date?: string | null
}

export type TenantLike = {
  full_name?: string | null
}

export type ContractWithTenantLike = ContractLike & {
  tenants?: TenantLike | TenantLike[] | null
}

export type ContractDisplayStatus = "vigente" | "finalizado" | "sin_contrato"

const ACTIVE_STATUSES = new Set(["active", "activo", "renewed", "prorrogado", "signed"])
const FINISHED_STATUSES = new Set(["expired", "vencido", "terminated", "rescindido"])

function parseDateOnly(value?: string | null) {
  if (!value) return null
  const [datePart] = value.split("T")
  if (!datePart) return null
  const date = new Date(`${datePart}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isActiveContractStatus(status?: string | null) {
  return ACTIVE_STATUSES.has((status || "").toLowerCase())
}

export function isFinishedContractStatus(status?: string | null) {
  return FINISHED_STATUSES.has((status || "").toLowerCase())
}

export function isContractInForce(contract: ContractLike | null | undefined, referenceDate = new Date()) {
  if (!contract || !isActiveContractStatus(contract.contract_status)) return false

  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)

  const start = parseDateOnly(contract.start_date)
  const end = parseDateOnly(contract.end_date)

  if (start && start > today) return false
  if (end && end < today) return false

  return true
}

export function sortContractsByStartDateDesc<T extends ContractLike>(contracts: T[]) {
  return [...contracts].sort((a, b) => {
    const aTime = parseDateOnly(a.start_date)?.getTime() ?? 0
    const bTime = parseDateOnly(b.start_date)?.getTime() ?? 0
    return bTime - aTime
  })
}

export function getActiveContractForProperty<T extends ContractLike>(
  propertyId: number | string | null | undefined,
  contracts: T[],
  referenceDate = new Date()
) {
  if (propertyId == null) return null
  const normalizedId = String(propertyId)

  return (
    sortContractsByStartDateDesc(contracts).find(
      (contract) =>
        String(contract.property_id ?? "") === normalizedId &&
        isContractInForce(contract, referenceDate)
    ) || null
  )
}

export function getActiveContractForTenant<T extends ContractLike>(
  tenantId: number | string | null | undefined,
  contracts: T[],
  referenceDate = new Date()
) {
  if (tenantId == null) return null
  const normalizedId = String(tenantId)

  return (
    sortContractsByStartDateDesc(contracts).find(
      (contract) =>
        String(contract.tenant_id ?? "") === normalizedId &&
        isContractInForce(contract, referenceDate)
    ) || null
  )
}

export function getMostRecentContractForTenant<T extends ContractLike>(
  tenantId: number | string | null | undefined,
  contracts: T[]
) {
  if (tenantId == null) return null
  const normalizedId = String(tenantId)

  return (
    sortContractsByStartDateDesc(contracts).find(
      (contract) => String(contract.tenant_id ?? "") === normalizedId
    ) || null
  )
}

export function getContractDisplayStatus(contract: ContractLike | null | undefined): ContractDisplayStatus {
  if (!contract) return "sin_contrato"
  return isContractInForce(contract) ? "vigente" : "finalizado"
}

export function getCurrentTenantNameForProperty(
  propertyId: number | string | null | undefined,
  contracts: ContractWithTenantLike[],
  fallback = "Vacante"
) {
  const contract = getActiveContractForProperty(propertyId, contracts)
  const tenantRelation = contract?.tenants
  const tenant = Array.isArray(tenantRelation) ? tenantRelation[0] : tenantRelation
  return tenant?.full_name || fallback
}

export function getDaysUntilContractEnd(contract: ContractLike, referenceDate = new Date()) {
  const end = parseDateOnly(contract.end_date)
  if (!end) return null

  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)

  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatContractEndDate(contract: ContractLike) {
  const end = parseDateOnly(contract.end_date)
  return end
    ? end.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "Sin fecha fin"
}
