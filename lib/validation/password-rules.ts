// lib/validation/password-rules.ts
export function validatePassword(password: string): string[] {
  const errors: string[] = []
  
  if (password.length < 8) errors.push('8 caractères minimum')
  if (!/[A-Z]/.test(password)) errors.push('Une majuscule')
  if (!/[a-z]/.test(password)) errors.push('Une minuscule')
  if (!/[0-9]/.test(password)) errors.push('Un chiffre')
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Un caractère spécial')
  
  return errors
}