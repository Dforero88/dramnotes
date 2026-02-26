# DramNotes

Application web Next.js pour la découverte de whiskies, la saisie de tasting notes, l’exploration sociale (follow/notebooks), les profils aromatiques et la gestion catalogue (whiskies/distillers/bottlers).

## 1) Vue métier (MVP)

Un utilisateur peut :
- créer un compte en 2 étapes (pré-inscription + finalisation après email)
- créer un whisky
- créer/éditer/supprimer sa tasting note
- voir les tasting notes publiques
- suivre/désuivre des profils publics
- consulter son notebook et celui des autres profils publics
- visualiser ses notes en mode liste / map depuis notebook
- utiliser le catalogue avec filtres, tris et pagination
- naviguer le catalogue en vue `Whiskies`, `Distillers`, `Bottlers`
- consulter une page publique distiller/bottler (description + whiskies liés)

Objectif produit actuel :
- maximiser la création de tasting notes
- améliorer la découverte de whiskies via activité/catalogue/explorer/notebook

## 2) Stack technique

- Next.js 15 (App Router)
- TypeScript
- Drizzle ORM
- SQLite en dev, MariaDB en prod
- Auth: NextAuth
- Monitoring erreurs/logs: Sentry
- Analytics: Google Analytics (GA4)
- Uptime: UptimeRobot via endpoint healthcheck

### 2.1 Composants techniques clés (actuels)

- Tracking client GA centralisé: `lib/analytics-client.ts` (`trackEvent` + `trackEventOnce`)
- Catalogue front (filtres/vues/CTA 0 résultat): `components/CatalogueBrowser.tsx`
- CTA signup traqué côté composants: `components/SignupCtaLink.tsx`, `components/GuestSignupNudge.tsx`
- Tracking onboarding home: `components/HomeOnboardingChecklist.tsx`
- Bootstrap GA (script + config): `app/layout.tsx`
- Flow auth 2 étapes: `app/[locale]/(auth)/register/page.tsx`, `app/[locale]/(auth)/complete-account/page.tsx`, `app/api/auth/register/route.ts`, `app/api/auth/confirm/route.ts`, `app/api/auth/complete-account/route.ts`

## 3) Lancement local

```bash
npm install
npm run dev
```

URL locale:
- [http://localhost:3000](http://localhost:3000)

## 4) Variables d’environnement clés

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `APP_URL`
- `JWT_SECRET`
- `ADMIN_EMAILS` (optionnel, CSV, fallback: `forerodavid88@gmail.com`)
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN` (optionnel, conseillé)
- `NEXT_PUBLIC_GA_ID`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

## 5) Sécurité, modération, robustesse

### 5.1 Modération/sanitization

Fichier principal: `lib/moderation.ts`

En place:
- sanitization texte (suppression balises HTML, chars contrôle, trim/collapse spaces)
- limites de longueur par champ
- validation regex sur pseudo/tag
- blacklist via table `moderation_terms` (fallback liste par défaut si table indisponible)
- normalisation anti-contournement basique (accents, leetspeak)

Champs modérés notamment:
- pseudo
- tags
- overall
- whisky name
- location
- display names (distiller/bottler/région/type/etc.)

### 5.2 Contrôle distiller/bottler (anti-doublons)

Fichier: `lib/producer-name.ts`

Pipeline:
- normalisation OCR côté client (avant remplissage formulaire)
- normalisation au submit côté client
- normalisation au backend avant validation + upsert

Règles:
- suppression des suffixes finaux non désirés (`dist`, `distillery`, `co`, `ltd`, `inc`, etc.)
- unification `and` -> `&`
- suppression des connecteurs orphelins finaux (`&`, `and`)
- nettoyage ponctuation/espaces

But:
- réduire les doublons de noms (`Ardbeg Distillery` vs `Ardbeg`)

### 5.3 Headers sécurité et rate limiting

- CSP + headers sécurité gérés dans `middleware.ts`
- rate limiting léger sur routes sensibles

### 5.4 Règles légales minimales

- case à cocher politique de confidentialité obligatoire à l’inscription
- case à cocher 18+ obligatoire à l’inscription
- page de politique de confidentialité
- profils publics/privés (contrôle visibilité utilisateur)

### 5.5 Flow inscription/confirmation (KISS)

Step 1 (register):
- email
- case 18+
- case CGU/privacy

Step 2:
- envoi email de confirmation (lien 30 min)

Step 3:
- clic sur le lien email

Step 4 (obligatoire pour activer le compte):
- pseudo
- mot de passe (validation inline + mêmes règles de sécurité qu’avant)
- visibilité profil/notes
- visibilité étagère

Comportement email existant:
- compte confirmé: erreur “email déjà utilisé”
- compte non confirmé: pas de nouveau compte, token régénéré + email renvoyé

Note:
- pas de migration DB nécessaire pour ce flow (approche pseudo/password temporaires tant que non confirmé)

## 6) Pagination et limites (où c’est appliqué)

- Catalogue: `12` items/page (`components/CatalogueBrowser.tsx` + `/api/whisky/list`)
- Catalogue distillers: `12` items/page (`/api/distillers/list`)
- Catalogue bottlers: `12` items/page (`/api/bottlers/list`)
- Explorer: `12` users/page (`components/ExplorerPageClient.tsx` + `/api/explorer/users`)
- Explorer query vide: top `3` profils
- Page whisky (autres notes): `6` notes/page (`components/TastingNotesSection.tsx` + `/api/tasting-notes/public`)
- Notebook notes (liste): `12` notes/page (`/api/notebook/notes`)
- Notebook followers: `12` users/page (`/api/notebook/followers`)
- Notebook following: `12` users/page (`/api/notebook/following`)
- Home activités: limit `8` (`app/[locale]/page.tsx`)
- Page distiller: `12` whiskies/page
- Page bottler: `12` whiskies/page

## 7) Google Analytics (détail tracking)

### 7.1 Tracking automatique

- `page_view` (GA4 standard via `gtag('config', ...)`)

### 7.2 Events custom actuellement envoyés

| Event | Déclenchement | Paramètres |
|---|---|---|
| `login_completed` | connexion réussie | `source_context`, `method`, `locale` |
| `onboarding_completed` | checklist onboarding home complétée | `source` |
| `whisky_created` | création whisky réussie | `whisky_id` |
| `cta_signup_click` | clic sur un CTA “Créer un compte” (visiteur non connecté) | `source_context` |
| `tasting_note_published` | publication note réussie | `whisky_id`, `published_from`, `source_context` |
| `tasting_note_draft_created` | brouillon créé | `whisky_id` |
| `tasting_note_draft_deleted` | brouillon supprimé | `whisky_id` ou `note_id` selon contexte |
| `tasting_note_deleted` | note publiée supprimée | `whisky_id` |
| `shelf_status_set` | changement statut étagère | `whisky_id`, `status` |
| `search_performed` | recherche lancée (catalogue/explorer) | `query_length`, `filters_count`, `filter_types`, `source_context`, `search_view`, `results_count` |
| `catalogue_view_selected` | affichage/changement de vue catalogue | `source_context`, `selected_view`, `previous_view`, `trigger` |
| `catalogue_zero_results_cta_shown` | affichage du bloc CTA sur 0 résultat (vue whiskies) | `source_context`, `search_view`, `query_length`, `filters_count` |
| `catalogue_zero_results_cta_click` | clic CTA du bloc 0 résultat | `source_context`, `cta_target`, `search_view`, `query_length`, `filters_count` |
| `guest_nudge_shown` | affichage du nudge signup visiteur | `source_context`, `trigger_type`, `actions_count`, `seconds_on_page` |
| `guest_nudge_close` | fermeture du nudge visiteur | `source_context`, `reason`, `trigger_type` |
| `guest_nudge_signup_click` | clic signup depuis nudge visiteur | `source_context`, `trigger_type` |
| `guest_nudge_login_click` | clic login depuis nudge visiteur | `source_context`, `trigger_type` |
| `follow_user` | follow réussi | `target_user_id` |
| `unfollow_user` | unfollow réussi | `target_user_id` |
| `notebook_section_view` | changement section notebook (hors `notes`) | `section`, `viewer_is_owner`, `profile_pseudo` |
| `notebook_notes_map_viewed` | vue map activée dans notebook | `viewer_is_owner`, `profile_pseudo` |
| `activity_click` | clic sur une activité home feed | `activity_type`, `whisky_id`, `profile_pseudo` |
| `activity_new_note_click` | clic activité type “new_note” | `whisky_id`, `profile_pseudo` |
| `activity_new_whisky_click` | clic activité type “new_whisky” | `whisky_id`, `profile_pseudo` |
| `activity_shelf_add_click` | clic activité type “shelf_add” | `whisky_id`, `profile_pseudo` |
| `onboarding_step_click` | clic sur une étape checklist onboarding home | `step_id`, `source` |
| `onboarding_done_cta_click` | clic CTA de fin checklist onboarding home | `source` |
| `onboarding_done_dismiss` | masquage checklist onboarding complétée | `source` |
| `account_data_exported` | export RGPD réussi | `files_count` |
| `account_deleted` | suppression compte réussie | - |

Notes implémentation catalogue:
- le bloc “Il manque un whisky ?” est géré côté `CatalogueBrowser`
- affiché dans les résultats uniquement en cas de `0 résultat` sur la vue `whiskies`
- s’il est affiché dans les résultats, il n’est pas affiché en footer (anti-duplication)

### 7.3 Source contexts `cta_signup_click` (actuels)

- `navigation_header`
- `home_hero`
- `home_activity_block`
- `catalogue_guest_block`
- `catalogue_zero_results_guest_block`
- `explorer_guest_block`
- `map_guest_block`
- `notebook_guest_block`
- `whisky_tasting_section`
- `login_page`
- `forgot_password_page`
- `auth_block`
- `nudge_floating_inline_form`

Fichier client tracking:
- `lib/analytics-client.ts`

Principaux points d’émission:
- `app/[locale]/(auth)/register/page.tsx`
- `app/[locale]/add-whisky/page.tsx`
- `components/TastingNotesSection.tsx`
- `components/ExplorerPageClient.tsx`
- `components/NotebookPage.tsx`
- `components/CatalogueBrowser.tsx`
- `components/WhiskyShelfControl.tsx`
- `components/HomeActivitiesFeed.tsx`
- `components/SignupCtaLink.tsx`
- `components/GuestSignupNudge.tsx`
- `components/HomeOnboardingChecklist.tsx`

## 8) Sentry (détail monitoring)

### 8.1 Initialisation

- server/edge: `instrumentation.ts`
- client: `sentry.client.config.ts`
- capture des erreurs React globales: `app/global-error.tsx`

### 8.2 Ce qui remonte

Erreurs:
- exceptions globales App Router (global error boundary)
- exceptions capturées manuellement (ex: route debug)

Logs applicatifs (captureMessage niveau info):
- `account_created` (tag `userId`)
- `whisky_created` (tag `whiskyId`)
- `tasting_note_published` (tags `userId`, `whiskyId`)
- `tasting_note_created` (legacy encore présent sur un chemin de création)
- `aroma_whisky_recomputed` (tag `whiskyId`)
- `aroma_user_recomputed` (tag `userId`)

Route de test:
- `GET /api/debug/sentry`
- retourne `eventId` si DSN actif

## 9) Whiskies Similaires

Feature:
- bloc “Whiskies similaires” sur la page whisky
- max 4 résultats (non forcés)

Logique actuelle (anti-bruit, petit catalogue):
- même producteur pertinent (DB: `distiller_id`, IB: `bottler_id`) => `+4`
- même région => `+2`
- même type => `+0` (désactivé)
- même pays => `+0` (désactivé)
- seuil d’affichage: `score >= 2`

Tri:
- score décroissant
- puis nom alphabétique

Recalcul:
- automatique après création whisky
- automatique après édition whisky (dont réassignation distiller/bottler)
- automatique après merge distiller/bottler

Backfill manuel:
```bash
# dev
DATABASE_URL=file:dev.db npm run whisky-related:rebuild -- --top=20

# prod
cd /srv/customer/sites/dramnotes.com
set -a
. ./config/runtime.env
set +a
npm run whisky-related:rebuild -- --top=20
```

## 10) UptimeRobot / Healthcheck

Endpoint:
- `GET /api/health`

Comportement:
- `200` + `{ "ok": true }` si DB accessible
- `500` + `{ "ok": false }` sinon

Usage UptimeRobot recommandé:
- monitor HTTP(s) sur `/api/health`
- fréquence 1 à 5 minutes
- alerte email active

## 11) Données conservées / uploads

- Images utilisateurs (bouteilles) stockées dans `public/uploads/...`
- Images distillers/bottlers stockées dans `public/uploads/producers/...`
- Les uploads sont exclus de Git
- Le dossier est conservé via `.gitkeep`

Important:
- ne pas versionner les fichiers d’upload
- garder `config/runtime.env` hors Git

## 12) Déploiement (résumé opérationnel)

Flux actuel:
- push GitHub
- CI build/deploy
- restart app géré manuellement sur serveur

Serveur cible principal:
- `dramnotes.com`

Commandes serveur usuelles:
```bash
cd /srv/customer/sites/dramnotes.com
git fetch origin
git reset --hard origin/main
git clean -fd -e public/uploads -e config/runtime.env -e .next
chmod +x /srv/customer/sites/dramnotes.com/start.sh
```

## 13) Admin producteurs (distillers/bottlers)

Page:
- `/<locale>/admin/producers`

Accès:
- restreint à la whitelist email admin (`ADMIN_EMAILS`)
- fallback si variable absente: `forerodavid88@gmail.com`

Fonctions:
- filtre par nom
- filtre rapide `sans description` et/ou `sans photo`
- édition: nom, pays, région, description FR/EN
- upload image (normalisée carrée WebP)

APIs:
- `GET /api/admin/producers/list`
- `PATCH /api/admin/producers/[id]`
- `POST /api/admin/producers/[id]/image`

## 14) État “ready for prod”

### Fait

- base sécurité/modération en place
- validation front + backend sur flux critiques
- analytics GA + events métier
- monitoring Sentry
- endpoint health + monitoring uptime
- pagination/limites sur écrans et APIs critiques
- normalisation distiller/bottler pour réduire la dette de données
- admin minimal opérationnel pour enrichissement producteur
- SEO de base (sitemap, robots, metadata pages clés)

### Backlog non bloquant

- tests de restauration backup (procédure validée de bout en bout)
- anti-bot avancé (captcha/WAF) si montée de spam
- playbook incident plus formalisé
- migrations outillées si fréquence de changements schéma augmente
- catégorisation des tags (familles aromatiques)
