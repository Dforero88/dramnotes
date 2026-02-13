// lib/validation/schemas.ts
import { z } from 'zod'
import { validatePassword } from './password-rules'

export const registerSchema = z.object({
  pseudo: z.string()
    .min(3, 'Le pseudo doit contenir au moins 3 caractères')
    .max(30, 'Le pseudo ne peut pas dépasser 30 caractères')
    .regex(/^[a-zA-Z0-9_]+$/, 'Le pseudo ne peut contenir que des lettres, chiffres et underscores')
    .regex(/^[a-zA-Z]/, 'Le pseudo doit commencer par une lettre'),
  
  email: z.string()
    .email('Email invalide')
    .max(100, 'Email trop long'),
  
  password: z.string()
    .min(1, 'Mot de passe requis')
    .refine((password) => {
      const errors = validatePassword(password)
      return errors.length === 0
    }, {
      message: 'Le mot de passe ne respecte pas les règles de sécurité'
    }),
  acceptedTerms: z.boolean().refine((value) => value === true, {
    message: 'Veuillez accepter la politique de confidentialité',
  }),
  visibility: z.enum(['private', 'public']).default('private'),
  shelfVisibility: z.enum(['private', 'public']).default('private'),
})

export const confirmSchema = z.object({
  token: z.string().min(10, 'Token invalide')
})

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis')
})
