import crypto from 'crypto'

export interface WhiskyOcrResult {
  name: string
  distiller: string | null
  bottler: string | null
  distilled_year: number | null
  bottled_year: number | null
  age: number | null
  cask_type: string | null
  batch_id: string | null
  alcohol_volume: number | null
  bottled_for: string | null
  country: string | null
  region: string | null
  category: string | null
}

function getGoogleVisionKey(): { client_email: string; private_key: string } {
  const fs = require('fs')
  const path = require('path')
  const keyPath =
    process.env.GOOGLE_VISION_KEY_PATH ||
    path.join(process.cwd(), 'config', 'google-vision-key.json')
  if (!fs.existsSync(keyPath)) {
    throw new Error('Google Vision key file not found in config/google-vision-key.json')
  }
  const raw = JSON.parse(fs.readFileSync(keyPath, 'utf8'))
  if (!raw?.client_email || !raw?.private_key) {
    throw new Error('Invalid Google Vision service account key')
  }
  return { client_email: raw.client_email, private_key: raw.private_key }
}

async function getGoogleAccessToken(): Promise<string> {
  const { client_email, private_key } = getGoogleVisionKey()
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const claim = Buffer.from(JSON.stringify({
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/cloud-vision',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const data = `${header}.${claim}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(data)
  const signature = sign.sign(private_key, 'base64url')
  const jwt = `${data}.${signature}`

  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const json = await res.json()
  if (!json?.access_token) {
    throw new Error(`Google token error: ${JSON.stringify(json)}`)
  }
  return json.access_token as string
}

export async function callGoogleVision(base64Image: string): Promise<string> {
  const token = await getGoogleAccessToken()
  const request = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: 'TEXT_DETECTION' }],
      },
    ],
  }

  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  })

  const json = await res.json()
  if (!res.ok) {
    const message = json?.error?.message || 'Unknown Google Vision error'
    throw new Error(`Google Vision API error: ${message}`)
  }

  return json?.responses?.[0]?.fullTextAnnotation?.text || ''
}

export async function parseWithOpenAI(ocrText: string): Promise<WhiskyOcrResult> {
  const openaiKey = process.env.WHISKYSCAN_OPENAI_KEY
  if (!openaiKey) {
    throw new Error('WHISKYSCAN_OPENAI_KEY not configured')
  }

  const prompt = `Tu es un expert en whiskies.
Tu reçois un texte issu d'un OCR (Google Vision), provenant d'une étiquette de bouteille de whisky.
Extrait les informations suivantes du texte OCR d'une étiquette de whisky:

RETOURNE UNIQUEMENT UN JSON VALIDE avec ces champs (alignés avec la table whiskies):
{
  "name": "string",                // Nom complet du whisky (obligatoire), ex: "Laphroaig 20 Years Old", "Ardbeg Wee Beastie", "Daftmill 2012 – Summer Batch (2025)"
  "distiller": "string|null",      // Nom de la distillerie si connu, ex: "Laphroaig"
  "bottler": "string|null",        // Nom de l'embouteilleur si différent de la distillerie ou si la distillerie est inconnue, mettre "Distillery Bottling" si c'est la distillerie qui a embouteillé
  "distilled_year": "integer|null",// Année distillation, ex: 2012
  "bottled_year": "integer|null",  // Année mise en bouteille, ex: 2025
  "age": "integer|null",           // Âge en années, ex: 20
  "cask_type": "string|null",      // Type de fût, ex: "Bourbon", "Sherry", "Port"
  "batch_id": "string|null",       // Numéro ou nom de batch / édition, ex: "Summer Batch Release"
  "alcohol_volume": "float|null",  // Degré d'alcool (ex: 46.0)
  "bottled_for": "string|null",    // Embouteillé pour
  "country": "string|null",        // Pays TOUJOURS en anglais (ex: "Scotland", "United States", "Japan")
  "region": "string|null",         // Région de production, ex: "Islay"
  "type": "string|null"            // Type (obligatoire si connu) : American whiskey, Blend, Blended Grain, Blended Malt, Bourbon, Canadian Whisky, Corn, Rye, Single Grain, Single Malt, Single Pot Still, Spirit, Tennesse, Wheat
}

Règles:
- Si info manquante: null
- Ne pas inventer
- Format JSON uniquement
- Le champ "type" DOIT être exactement l'une des valeurs listées ci-dessus (ou null si incertain)

Texte OCR:
${ocrText}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 1000,
    }),
  })

  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Invalid OpenAI response')
  }

  const cleaned = String(content).replace(/^```json\s*|```$/g, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!parsed?.name) {
    throw new Error('Invalid JSON or missing name field')
  }

  return parsed as WhiskyOcrResult
}
