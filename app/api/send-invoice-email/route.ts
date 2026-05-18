import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/server/supabase-auth"

type SendInvoiceEmailBody = {
  to?: string
  from?: string
  subject?: string
  text?: string
  html?: string
  filename?: string
  pdfBase64?: string
}

const MAX_PDF_BASE64_LENGTH = 20 * 1024 * 1024

function getAllowedFromEmails() {
  return (process.env.ALLOWED_FROM_EMAILS || process.env.NEXT_PUBLIC_ALLOWED_FROM_EMAILS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function sanitizeAttachmentName(value: string) {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return cleaned.endsWith(".pdf") ? cleaned : `${cleaned || "recibo"}.pdf`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Falta configurar RESEND_API_KEY" },
        { status: 500 }
      )
    }

    const body = (await request.json()) as SendInvoiceEmailBody

    const to = body.to?.trim()
    const from = body.from?.trim()
    const subject = body.subject?.trim()
    const text = body.text?.trim()
    const html = body.html?.trim()
    const pdfBase64 = body.pdfBase64?.trim()
    const filename = sanitizeAttachmentName(body.filename || "recibo.pdf")

    if (!to || !from || !subject || !pdfBase64 || (!text && !html)) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios para enviar el recibo" },
        { status: 400 }
      )
    }

    if (pdfBase64.length > MAX_PDF_BASE64_LENGTH) {
      return NextResponse.json(
        { error: "El PDF adjunto es demasiado grande para enviarlo." },
        { status: 413 }
      )
    }

    const allowedFromEmails = getAllowedFromEmails()

    if (allowedFromEmails.length > 0 && !allowedFromEmails.includes(from)) {
      return NextResponse.json(
        { error: `El remitente ${from} no esta permitido. Revisa ALLOWED_FROM_EMAILS.` },
        { status: 400 }
      )
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: text || undefined,
        html: html || undefined,
        attachments: [
          {
            filename,
            content: pdfBase64,
          },
        ],
      }),
    })

    const resendJson = await resendResponse.json()

    if (!resendResponse.ok) {
      return NextResponse.json(
        { error: "No se pudo enviar el email. Revisa la configuracion del proveedor." },
        { status: resendResponse.status >= 400 && resendResponse.status < 500 ? 400 : 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      emailId: resendJson?.id || null,
    })
  } catch {
    return NextResponse.json(
      { error: "No se pudo procesar el envio del recibo" },
      { status: 500 }
    )
  }
}
