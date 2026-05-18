import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/server/supabase-auth"

type PropertyCandidate = {
  id: number
  name: string
  address?: string | null
  supplies?: Record<string, { company?: string; contract?: string } | undefined> | null
}

type AnalyzeExpenseInvoiceBody = {
  fileName?: string
  mimeType?: string
  base64?: string
  properties?: PropertyCandidate[]
  categories?: string[]
}

type ExpenseAnalysis = {
  category: string | null
  amount: number | null
  date: string | null
  property_id: number | null
  property_name: string | null
  responsibility: "owner" | "tenant" | null
  confidence: number
  notes: string
  source: "ai" | "heuristic"
}

const MAX_ANALYSIS_BASE64_LENGTH = 20 * 1024 * 1024

const DEFAULT_CATEGORIES = [
  "Seguro",
  "Limpieza",
  "Comunidad",
  "Electricidad",
  "Gas",
  "Agua",
  "IBI",
  "Internet",
  "Hipoteca",
  "Derrama",
  "Basura",
  "Otro",
]

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalizeText(term)))
}

function inferCategory(text: string) {
  if (includesAny(text, ["electricidad", "luz", "iberdrola", "endesa", "naturgy electricidad", "edp"])) return "Electricidad"
  if (includesAny(text, ["gas", "naturgy", "repsol gas"])) return "Gas"
  if (includesAny(text, ["agua", "aqualia", "canal", "suministro agua"])) return "Agua"
  if (includesAny(text, ["internet", "fibra", "movistar", "orange", "vodafone", "digi", "telefono"])) return "Internet"
  if (includesAny(text, ["seguro", "mapfre", "allianz", "axa", "mutua"])) return "Seguro"
  if (includesAny(text, ["comunidad", "administracion de fincas"])) return "Comunidad"
  if (includesAny(text, ["ibi", "impuesto bienes inmuebles"])) return "IBI"
  if (includesAny(text, ["hipoteca", "prestamo"])) return "Hipoteca"
  if (includesAny(text, ["derram", "extraordinaria"])) return "Derrama"
  if (includesAny(text, ["basura", "residuos"])) return "Basura"
  if (includesAny(text, ["limpieza"])) return "Limpieza"
  return "Otro"
}

function inferResponsibility(category: string | null): "owner" | "tenant" {
  if (category && ["Electricidad", "Gas", "Agua", "Internet"].includes(category)) return "tenant"
  return "owner"
}

function inferAmount(text: string) {
  const matches = [...text.matchAll(/(\d{1,5}(?:[.,]\d{2}))/g)]
  const numbers = matches
    .map((match) => Number(match[1].replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (numbers.length === 0) return null
  return Math.max(...numbers)
}

function inferDate(text: string) {
  const iso = text.match(/(20\d{2})[-_/](0?[1-9]|1[0-2])[-_/]([0-2]?\d|3[01])/)
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`
  }

  const spanish = text.match(/([0-2]?\d|3[01])[-_/](0?[1-9]|1[0-2])[-_/](20\d{2})/)
  if (spanish) {
    return `${spanish[3]}-${spanish[2].padStart(2, "0")}-${spanish[1].padStart(2, "0")}`
  }

  return null
}

function propertySearchText(property: PropertyCandidate) {
  const supplyText = Object.values(property.supplies || {})
    .flatMap((supply) => [supply?.company || "", supply?.contract || ""])
    .join(" ")

  return normalizeText(`${property.name || ""} ${property.address || ""} ${supplyText}`)
}

function inferProperty(text: string, properties: PropertyCandidate[]) {
  const scored = properties
    .map((property) => {
      const candidateText = propertySearchText(property)
      const nameWords = normalizeText(property.name || "")
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 2)

      const addressWords = normalizeText(property.address || "")
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 4)

      const exactSupplyMatch = Object.values(property.supplies || {}).some((supply) => {
        const contract = normalizeText(supply?.contract || "")
        return contract.length >= 5 && text.includes(contract)
      })

      const score =
        (exactSupplyMatch ? 20 : 0) +
        nameWords.filter((word) => text.includes(word)).length * 3 +
        addressWords.filter((word) => text.includes(word)).length * 2 +
        (candidateText && text.includes(candidateText) ? 10 : 0)

      return { property, score }
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  return best && best.score > 0 ? best.property : null
}

function heuristicAnalysis(body: AnalyzeExpenseInvoiceBody): ExpenseAnalysis {
  const fileText = normalizeText(body.fileName || "")
  const category = inferCategory(fileText)
  const property = inferProperty(fileText, body.properties || [])
  const amount = inferAmount(fileText)
  const date = inferDate(fileText)
  const inferredFields = [category !== "Otro", !!property, !!amount, !!date].filter(Boolean).length

  return {
    category,
    amount,
    date,
    property_id: property?.id ?? null,
    property_name: property?.name ?? null,
    responsibility: inferResponsibility(category),
    confidence: Math.min(0.25 + inferredFields * 0.15, 0.7),
    notes:
      "Analisis local por nombre de archivo. Configura OPENAI_API_KEY para leer el contenido real de PDFs, imagenes y DOCX.",
    source: "heuristic",
  }
}

function extractResponseText(payload: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (typeof payload.output_text === "string") return payload.output_text
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("")
}

function buildFileContent(fileName: string, mimeType: string, base64: string) {
  if (mimeType.startsWith("image/")) {
    return {
      type: "input_image",
      image_url: `data:${mimeType};base64,${base64}`,
    }
  }

  return {
    type: "input_file",
    filename: fileName,
    file_data: `data:${mimeType || "application/octet-stream"};base64,${base64}`,
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: AnalyzeExpenseInvoiceBody

  try {
    body = (await request.json()) as AnalyzeExpenseInvoiceBody
  } catch {
    return NextResponse.json({ error: "La solicitud no tiene un JSON valido." }, { status: 400 })
  }

  const categories = body.categories?.length ? body.categories : DEFAULT_CATEGORIES
  const fallback = heuristicAnalysis(body)

  if (body.base64 && body.base64.length > MAX_ANALYSIS_BASE64_LENGTH) {
    return NextResponse.json(
      { ...fallback, notes: "La factura supera el tamano maximo permitido para analisis." },
      { status: 413 }
    )
  }

  if (!process.env.OPENAI_API_KEY || !body.base64 || !body.fileName) {
    return NextResponse.json(fallback)
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_INVOICE_MODEL || "gpt-5",
        instructions:
          "Extrae datos de facturas de suministros o gastos inmobiliarios en España. Devuelve solo JSON valido ajustado al esquema. Si no estas seguro, usa null y baja la confianza.",
        input: [
          {
            role: "user",
            content: [
              buildFileContent(body.fileName, body.mimeType || "application/octet-stream", body.base64),
              {
                type: "input_text",
                text: JSON.stringify({
                  task: "Rellena un formulario de gasto de GestiDomus.",
                  categories,
                  properties: body.properties || [],
                  rules: [
                    "category debe ser una de las categorias dadas.",
                    "amount es el total a pagar de la factura.",
                    "date es la fecha de emision o cargo en formato YYYY-MM-DD.",
                    "property_id debe coincidir con el inmueble mas probable usando direccion, nombre, CUPS, numero de contrato o datos de suministros.",
                    "responsibility suele ser tenant para Electricidad, Gas, Agua e Internet, y owner para IBI, Comunidad, Seguro, Hipoteca, Derrama, Basura o Limpieza.",
                  ],
                }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "expense_invoice_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                category: { type: ["string", "null"], enum: [...categories, null] },
                amount: { type: ["number", "null"] },
                date: { type: ["string", "null"] },
                property_id: { type: ["number", "null"] },
                property_name: { type: ["string", "null"] },
                responsibility: { type: ["string", "null"], enum: ["owner", "tenant", null] },
                confidence: { type: "number" },
                notes: { type: "string" },
              },
              required: [
                "category",
                "amount",
                "date",
                "property_id",
                "property_name",
                "responsibility",
                "confidence",
                "notes",
              ],
            },
          },
        },
      }),
    })

    const payload = await response.json()
    if (!response.ok) {
      return NextResponse.json({
        ...fallback,
        notes: `No se pudo usar IA. ${fallback.notes}`,
      })
    }

    const parsed = JSON.parse(extractResponseText(payload)) as Omit<ExpenseAnalysis, "source">
    return NextResponse.json({ ...parsed, source: "ai" })
  } catch {
    return NextResponse.json({
      ...fallback,
      notes: `No se pudo analizar con IA. ${fallback.notes}`,
    })
  }
}
