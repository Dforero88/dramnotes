# DramNotes

Application web Next.js pour la découverte de whiskies, la saisie de tasting notes, l’exploration sociale (follow/notebooks), les profils aromatiques et la gestion catalogue (whiskies/distillers/bottlers).

## 1) Vue métier (MVP)

Un utilisateur peut :
- créer un compte et le confirmer par email
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
- page de politique de confidentialité
- profils publics/privés (contrôle visibilité utilisateur)

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
| `account_created` | inscription réussie | `user_id` (si disponible) |
| `login_completed` | connexion réussie | `source_context`, `method`, `locale` |
| `onboarding_started` | début onboarding post-inscription | `user_id` (si dispo), `entry_point`, `source_context`, `locale` |
| `onboarding_completed` | 1re valeur atteinte (1re note publiée) | `user_id`, `completion_type`, `source_context`, `locale` |
| `whisky_created` | création whisky réussie | `whisky_id` |
| `tasting_note_published` | publication note réussie | `whisky_id`, `published_from`, `source_context` |
| `search_performed` | recherche lancée (catalogue/explorer) | `query_length`, `filters_count`, `filter_types`, `source_context`, `search_view`, `results_count` |
| `catalogue_view_selected` | affichage/changement de vue catalogue | `source_context`, `selected_view`, `previous_view`, `trigger` |
| `follow_user` | follow réussi | `target_user_id` |
| `unfollow_user` | unfollow réussi | `target_user_id` |
| `notebook_section_view` | changement section notebook (hors `notes`) | `section`, `viewer_is_owner`, `profile_pseudo` |
| `notebook_notes_map_viewed` | vue map activée dans notebook | `viewer_is_owner`, `profile_pseudo` |

Fichier client tracking:
- `lib/analytics-client.ts`

Principaux points d’émission:
- `app/[locale]/(auth)/register/page.tsx`
- `app/[locale]/add-whisky/page.tsx`
- `components/TastingNotesSection.tsx`
- `components/ExplorerPageClient.tsx`
- `components/NotebookPage.tsx`

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
- `tasting_note_created` (tags `userId`, `whiskyId`)
- `aroma_whisky_recomputed` (tag `whiskyId`)
- `aroma_user_recomputed` (tag `userId`)

Route de test:
- `GET /api/debug/sentry`
- retourne `eventId` si DSN actif

## 9) UptimeRobot / Healthcheck

Endpoint:
- `GET /api/health`

Comportement:
- `200` + `{ "ok": true }` si DB accessible
- `500` + `{ "ok": false }` sinon

Usage UptimeRobot recommandé:
- monitor HTTP(s) sur `/api/health`
- fréquence 1 à 5 minutes
- alerte email active

## 10) Données conservées / uploads

- Images utilisateurs (bouteilles) stockées dans `public/uploads/...`
- Images distillers/bottlers stockées dans `public/uploads/producers/...`
- Les uploads sont exclus de Git
- Le dossier est conservé via `.gitkeep`

Important:
- ne pas versionner les fichiers d’upload
- garder `config/runtime.env` hors Git

## 11) Déploiement (résumé opérationnel)

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

## 12) Admin producteurs (distillers/bottlers)

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

## 13) État “ready for prod”

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
