import nodemailer from 'nodemailer'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

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

// Vérifier la connexion SMTP
transporter.verify((error) => {
  if (error) {
    console.error('❌ Erreur connexion SMTP:', error.message)
  } else {
    console.log('✅ Serveur SMTP prêt')
  }
})

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const from = process.env.SMTP_FROM || 'no-reply@dramnotes.com'
    
    const info = await transporter.sendMail({
      from: `"DramNotes" <${from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    })
    
    console.log(`📧 Email envoyé à ${options.to}: ${info.messageId}`)
    return true
  } catch (error) {
    console.error('❌ Erreur envoi email:', error)
    return false
  }
}

// Template d'email de confirmation
export function getConfirmationEmailTemplate(
  pseudo: string,
  confirmationUrl: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #8B4513; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #D4A76A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DramNotes</h1>
      <p>Votre carnet de dégustation de whisky</p>
    </div>
    <div class="content">
      <h2>Bonjour ${pseudo} !</h2>
      <p>Merci de vous être inscrit sur DramNotes. Pour commencer à utiliser votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
      
      <p style="text-align: center; margin: 40px 0;">
        <a href="${confirmationUrl}" class="button">Confirmer mon compte</a>
      </p>
      
      <p>Ce lien expirera dans 30 minutes. Si vous ne l'avez pas demandé, vous pouvez ignorer cet email.</p>
      
      <p>À bientôt sur DramNotes ! 🥃</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} DramNotes. Tous droits réservés.</p>
      <p>Si le bouton ne fonctionne pas, copiez ce lien : ${confirmationUrl}</p>
    </div>
  </div>
</body>
</html>
  `
}