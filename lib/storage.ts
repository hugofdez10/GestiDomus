import type { SupabaseClient } from "@supabase/supabase-js"

export const STORAGE_SIGNED_URL_TTL_SECONDS = 15 * 60

export function isExternalStorageUrl(value: string | null | undefined) {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

export async function getStorageDisplayUrl(
  supabase: SupabaseClient,
  bucket: string,
  storedValue: string | null | undefined
) {
  if (!storedValue) return null
  if (isExternalStorageUrl(storedValue)) return storedValue

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storedValue, STORAGE_SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    throw error || new Error("No se pudo generar un enlace temporal para el documento.")
  }

  return data.signedUrl
}
