import { createClient } from "@supabase/supabase-js"

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization")
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

export async function requireAuthenticatedUser(request: Request): Promise<AuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      status: 500,
      error: "Falta configurar Supabase en el servidor.",
    }
  }

  const token = getBearerToken(request)

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Debes iniciar sesion para realizar esta accion.",
    }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return {
      ok: false,
      status: 401,
      error: "La sesion no es valida o ha caducado.",
    }
  }

  return { ok: true, userId: data.user.id }
}
