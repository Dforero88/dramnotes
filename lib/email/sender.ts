import nodemailer from 'nodemailer'
import path from 'path'
import fs from 'fs/promises'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

type EmailLocale = 'fr' | 'en'

// Configuration SMTP Infomaniak
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.infomaniak.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour autres ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  // Pour éviter les problèmes de certificat en dev
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
})

let smtpVerified = false

async function verifySmtpOnce() {
  if (smtpVerified) return
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return
  try {
    await transporter.verify()
    smtpVerified = true
    console.log('✅ Serveur SMTP prêt')
  } catch (error: any) {
    console.error('❌ Erreur connexion SMTP:', error?.message || error)
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    await verifySmtpOnce()
    const from = process.env.SMTP_FROM || 'no-reply@dramnotes.com'
    const baseUrl = (process.env.APP_URL || 'https://dramnotes.com').replace(/\/+$/, '')
    const logoPath = path.join(process.cwd(), 'public', 'logo-email.png')
    const hasLogo = await fs.stat(logoPath).then(() => true).catch(() => false)
    const html = options.html.replace(
      /__DRAMNOTES_LOGO__/g,
      hasLogo ? 'cid:dramnotes-logo' : `${baseUrl}/logo-email.png`
    )
    const text = options.text || options.html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const info = await transporter.sendMail({
      from: `"DramNotes" <${from}>`,
      to: options.to,
      replyTo: options.replyTo,
      subject: options.subject,
      html,
      text,
      attachments: hasLogo ? [{ filename: 'logo-email.png', path: logoPath, cid: 'dramnotes-logo' }] : [],
    })
    
    console.log(`📧 Email envoyé à ${options.to}: ${info.messageId}`)
    return true
  } catch (error) {
    console.error('❌ Erreur envoi email:', error)
    return false
  }
}

function buildEmailLayout(content: string, locale: EmailLocale): string {
  const logo = '__DRAMNOTES_LOGO__'
  const preheader =
    locale === 'fr'
      ? 'Confirmez votre compte DramNotes'
      : 'Confirm your DramNotes account'

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f8fafc; font-family: Arial, sans-serif; color:#111827; }
    .wrapper { width:100%; padding:24px 12px; box-sizing:border-box; }
    .card { max-width:620px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; }
    .header { padding:16px 24px 8px 24px; text-align:center; }
    .logo { display:block; width:180px; height:auto; margin:0 auto; }
    .content { padding:28px 24px; line-height:1.55; }
    .buttonWrap { text-align:center; margin:26px 0; }
    .button { display:inline-block; text-decoration:none; border-radius:999px; background:#2A0F14; color:#ffffff !important; font-weight:600; padding:12px 22px; font-size:14px; }
    .muted { color:#6b7280; font-size:13px; }
    .footer { border-top:1px solid #e5e7eb; padding:18px 24px; color:#6b7280; font-size:12px; }
    .linkBox { margin-top:10px; word-break:break-all; font-size:12px; color:#4b5563; }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <img src="${logo}" alt="DramNotes" class="logo" />
      </div>
      ${content}
    </div>
  </div>
</body>
</html>
`
}

// Template d'email de confirmation
export function getConfirmationEmailTemplate(
  pseudo: string,
  confirmationUrl: string,
  locale: EmailLocale = 'fr'
): string {
  const content =
    locale === 'fr'
      ? `
      <div class="content">
        <h2 style="margin:0 0 10px 0; font-size:22px;">Bonjour,</h2>
        <p>Merci pour votre inscription sur DramNotes.</p>
        <p>Pour continuer, cliquez sur le bouton ci-dessous afin de finaliser votre compte :</p>
        <div class="buttonWrap">
          <a href="${confirmationUrl}" class="button">Continuer mon inscription</a>
        </div>
        <p class="muted">Ce lien expire dans 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>
      </div>
      <div class="footer">
        <div>© ${new Date().getFullYear()} DramNotes</div>
        <div class="linkBox">${confirmationUrl}</div>
      </div>
    `
      : `
      <div class="content">
        <h2 style="margin:0 0 10px 0; font-size:22px;">Hello,</h2>
        <p>Thanks for joining DramNotes.</p>
        <p>To continue, click the button below to finish your account setup:</p>
        <div class="buttonWrap">
          <a href="${confirmationUrl}" class="button">Continue registration</a>
        </div>
        <p class="muted">This link expires in 30 minutes. If this wasn’t you, you can ignore this email.</p>
      </div>
      <div class="footer">
        <div>© ${new Date().getFullYear()} DramNotes</div>
        <div class="linkBox">${confirmationUrl}</div>
      </div>
    `

  return buildEmailLayout(content, locale)
}

export function getResetPasswordEmailTemplate(
  pseudo: string,
  resetUrl: string,
  locale: EmailLocale = 'fr'
): string {
  const content =
    locale === 'fr'
      ? `
      <div class="content">
        <h2 style="margin:0 0 10px 0; font-size:22px;">Bonjour ${pseudo},</h2>
        <p>Vous avez demandé une réinitialisation de mot de passe.</p>
        <p>Utilisez le bouton ci-dessous pour définir un nouveau mot de passe :</p>
        <div class="buttonWrap">
          <a href="${resetUrl}" class="button">Réinitialiser le mot de passe</a>
        </div>
        <p class="muted">Ce lien expire dans 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>
      </div>
      <div class="footer">
        <div>© ${new Date().getFullYear()} DramNotes</div>
        <div class="linkBox">${resetUrl}</div>
      </div>
    `
      : `
      <div class="content">
        <h2 style="margin:0 0 10px 0; font-size:22px;">Hi ${pseudo},</h2>
        <p>You requested a password reset.</p>
        <p>Use the button below to set a new password:</p>
        <div class="buttonWrap">
          <a href="${resetUrl}" class="button">Reset password</a>
        </div>
        <p class="muted">This link expires in 30 minutes. If this wasn’t you, you can ignore this email.</p>
      </div>
      <div class="footer">
        <div>© ${new Date().getFullYear()} DramNotes</div>
        <div class="linkBox">${resetUrl}</div>
      </div>
    `

  return buildEmailLayout(content, locale)
}

export function getFirstNoteReminderEmailTemplate(
  pseudo: string | null | undefined,
  actionUrl: string,
  locale: EmailLocale = 'fr'
): string {
  const greetingName = pseudo?.trim() || ''
  const content =
    locale === 'fr'
      ? `
      <div class="content">
        <h2 style="margin:0 0 10px 0; font-size:22px;">Bonjour${greetingName ? ` ${greetingName}` : ''},</h2>
        <p>Votre compte DramNotes est prêt, et il ne manque plus qu’une chose pour vraiment le lancer : votre première note de dégustation.</p>
        <p>Une seule bouteille suffit pour commencer. Prenez quelques instants pour noter ce que vous avez ressenti, garder une trace de votre dégustation, et commencer à construire un profil aromatique qui vous ressemble.</p>
        <p>Au fil des notes, votre carnet prend vie, vos repères deviennent plus clairs, et l’expérience devient encore plus personnelle.</p>
        <div class="buttonWrap">
          <a href="${actionUrl}" class="button">Ajouter ma première note</a>
        </div>
        <p class="muted">Pas besoin d’écrire beaucoup pour commencer. Une note simple suffit largement, vous pourrez toujours l’enrichir ensuite.</p>
      </div>
      <div class="footer">
        <div>© ${new Date().getFullYear()} DramNotes</div>
        <div class="linkBox">${actionUrl}</div>
      </div>
    `
      : `
      <div class="content">
        <h2 style="margin:0 0 10px 0; font-size:22px;">Hello${greetingName ? ` ${greetingName}` : ''},</h2>
        <p>Your DramNotes account is ready, and there is just one thing left to truly get started: your first tasting note.</p>
        <p>One bottle is enough to begin. Take a few moments to capture what you felt, keep a memory of the tasting, and start building an aroma profile that genuinely reflects your taste.</p>
        <p>As your notes grow, your notebook becomes more alive, your references become clearer, and the experience feels even more personal.</p>
        <div class="buttonWrap">
          <a href="${actionUrl}" class="button">Add my first note</a>
        </div>
        <p class="muted">You do not need to write much to begin. A simple note is more than enough, and you can always enrich it later.</p>
      </div>
      <div class="footer">
        <div>© ${new Date().getFullYear()} DramNotes</div>
        <div class="linkBox">${actionUrl}</div>
      </div>
    `

  return buildEmailLayout(content, locale)
}

export function getExistingAccountEmailTemplate(
  loginUrl: string,
  resetUrl: string,
  locale: EmailLocale = 'fr'
): string {
  const content =
    locale === 'fr'
      ? `
      <div class="content">
        <h2 style="margin:0 0 10px 0; font-size:22px;">Bonjour,</h2>
        <p>Une demande d’inscription a été faite avec cette adresse email.</p>
        <p>Votre compte DramNotes existe déjà. Vous pouvez vous connecter directement, ou réinitialiser votre mot de passe si nécessaire.</p>
        <div class="buttonWrap">
          <a href="${loginUrl}" class="button">Se connecter</a>
        </div>
        <p class="muted" style="margin-top:14px;">Si vous ne vous souvenez plus de votre mot de passe, utilisez ce lien :</p>
        <div class="linkBox"><a href="${resetUrl}">${resetUrl}</a></div>
      </div>
      <div class="footer">
        <div>© ${new Date().getFullYear()} DramNotes</div>
      </div>
    `
      : `
      <div class="content">
        <h2 style="margin:0 0 10px 0; font-size:22px;">Hello,</h2>
        <p>A registration request was made with this email address.</p>
        <p>Your DramNotes account already exists. You can sign in directly, or reset your password if needed.</p>
        <div class="buttonWrap">
          <a href="${loginUrl}" class="button">Sign in</a>
        </div>
        <p class="muted" style="margin-top:14px;">If you do not remember your password, use this link:</p>
        <div class="linkBox"><a href="${resetUrl}">${resetUrl}</a></div>
      </div>
      <div class="footer">
        <div>© ${new Date().getFullYear()} DramNotes</div>
      </div>
    `

  return buildEmailLayout(content, locale)
}
