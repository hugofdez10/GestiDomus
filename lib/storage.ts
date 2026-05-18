import type { SupabaseClient } from "@supabase/supabase-js"

export const STORAGE_SIGNED_URL_TTL_SECONDS = 15 * 60

export function isExternalStorageUrl(value: string | null | undefined) {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

function getPathFromSupabaseStorageUrl(value: string, bucket: string) {
  try {
    const url = new URL(value)
    const publicPrefix = `/storage/v1/object/public/${bucket}/`
    const signPrefix = `/storage/v1/object/sign/${bucket}/`
    const matchedPrefix = [publicPrefix, signPrefix].find((prefix) => url.pathname.startsWith(prefix))

    if (!matchedPrefix) return null

    return decodeURIComponent(url.pathname.slice(matchedPrefix.length))
  } catch {
    return null
  }
}

export async function getStorageDisplayUrl(
  supabase: SupabaseClient,
  bucket: string,
  storedValue: string | null | undefined
) {
  if (!storedValue) return null
  const storagePath = isExternalStorageUrl(storedValue)
    ? getPathFromSupabaseStorageUrl(storedValue, bucket)
    : storedValue

  if (!storagePath) return storedValue

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, STORAGE_SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    throw error || new Error("No se pudo generar un enlace temporal para el documento.")
  }

  return data.signedUrl
}
