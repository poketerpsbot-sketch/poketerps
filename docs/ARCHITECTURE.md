# Architecture de la V1 Pokédex

## Décision d’accès PostgreSQL

La V1 utilise **Drizzle ORM avec le pilote `postgres`**. Drizzle reste une couche TypeScript
légère : les requêtes sont explicites, les transactions PostgreSQL restent accessibles et le
pilote fonctionne avec le pooler Supabase comme avec une connexion directe sur Render.

Le schéma SQL reste volontairement la source de vérité :

- `supabase/schema.sql` représente l’état complet, copiable dans SQL Editor ;
- `supabase/migrations/` conserve l’historique SQL ;
- `src/lib/db/schema.ts` fournit les types Drizzle utilisés par l’application.

Cette séparation évite de rendre le premier déploiement dépendant d’un générateur de migrations.

## Couches

```text
Telegram / navigateur
        │
        ▼
Next.js App Router
  ├─ pages et Server Components (lecture publique)
  ├─ Client Components isolés (formulaires, likes, Mini App)
  └─ Route Handlers (API, auth, uploads, webhook)
        │
        ▼
Sécurité applicative
  ├─ validation Zod et nettoyage des textes
  ├─ session signée HttpOnly + contrôle CSRF/origine
  ├─ RBAC relu en base
  ├─ limitation de débit persistante
  └─ journal d’audit
        │
        ▼
Services métier transactionnels
  ├─ catalogue et propositions
  ├─ vues dédupliquées / likes / favoris
  ├─ avis et modération
  ├─ classements et statistiques
  ├─ messages administratifs
  ├─ partenaires et publications Telegram
  └─ médias Supabase Storage
        │
        ▼
Supabase PostgreSQL + Storage
```

## Identité et sessions

1. La Mini App transmet uniquement la chaîne brute `Telegram.WebApp.initData`.
2. Le serveur vérifie la signature HMAC, la fraîcheur de `auth_date` et le rejeu.
3. L’utilisateur Telegram est créé ou actualisé en base.
4. Le serveur émet un cookie de session signé, `HttpOnly`, `Secure` en production et `SameSite=lax`.
5. Pour chaque action sensible, l’utilisateur et son rôle sont relus en PostgreSQL. Un rôle affiché
   dans l’interface n’accorde jamais un droit.

Le `telegramId` n’est inclus dans aucun DTO public.

## Données et cohérence

- Les vues sont enregistrées côté serveur avec un hash de session non réversible. Une fonction SQL
  verrouille la fiche, applique la fenêtre de déduplication puis incrémente le compteur agrégé.
- La contrainte unique `(entry_id, user_id)` garantit un seul J’aime. Like et unlike mettent le
  compteur à jour dans la même transaction.
- Une capture ne compte dans les classements que si elle est `PUBLISHED` et non supprimée.
- Les avis passent toujours par `PENDING_REVIEW`, puis par une action de modération autorisée.
- `original_contributor_id` est immuable lors des corrections et actions administratives.
- Toutes les actions administratives significatives écrivent dans `audit_logs`.

## Storage

Les clients n’obtiennent jamais la clé `service_role`. Les uploads passent par l’API Next.js, qui
contrôle la session, le rôle, le bucket, la taille et le MIME, réencode les images en WebP puis
fabrique un nom aléatoire. Une image de capture est d’abord stockée dans `entry-drafts`, privé, puis
copiée vers `entry-images` dans le workflow de publication. Les buckets de médias publiés peuvent
être lus publiquement ; `message-attachments` reste privé et se lit par URL signée de courte durée.
Aucune politique n’accorde un droit d’écriture générique aux rôles Supabase `anon` ou
`authenticated`, car l’identité primaire est Telegram.

## Déploiement

Render exécute un serveur Node.js Next.js. `next start` lit automatiquement `process.env.PORT`, que
Render injecte au démarrage. PostgreSQL et Storage restent sur Supabase. Aucun service, runtime ou
SDK propriétaire Vercel n’est utilisé.

## Évolutivité prévue

Les événements de vues, likes, expérience et clics sont conservés, ce qui permet d’ajouter plus tard
des agrégations périodiques ou vues matérialisées sans changer le modèle public. Les états du bot et
les publications Telegram sont persistants afin de permettre ensuite réponses admin, notifications
personnalisées et workflows plus longs.
