# Pokédex communautaire

Application éditoriale mobile-first pour consulter, proposer, vérifier et publier des fiches
communautaires. Elle comprend une application web, une Telegram Mini App, un bot Telegram, une
administration web et des workflows de modération persistés dans Supabase.

> Le projet est informatif et communautaire. Il ne comporte ni vente, ni commande, ni paiement, ni
> livraison, ni mise en relation commerciale. Les informations déclarées sur les produits ne sont
> pas des garanties et les contenus médicinaux ne remplacent pas un avis médical.

## Ce que contient la V1

- catalogue dynamique (catégories, sous-catégories, champs et microns) ;
- seed initial avec 20 fiches éditoriales de démonstration (2 dans chacune des 10 catégories) ;
- profils Telegram, rôles serveur et sessions sécurisées ;
- propositions, brouillons, validation et publication des captures ;
- vues serveur dédupliquées, J’aime, favoris et compteurs agrégés ;
- avis obligatoirement modérés avant publication ;
- classements semaine, mois et général pour dresseurs et fiches ;
- partenaires et partenaire à la une ;
- messages d’amélioration/signalements avec boîte admin ;
- bot Telegram, Mini App, callbacks de modération et publication canal ;
- audit administratif, rate limiting et Supabase Storage ;
- déploiement Node.js sur Render.

L’architecture et les choix techniques sont détaillés dans
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Prérequis

- Node.js 22 (minimum supporté par Next.js : 20.9) ;
- npm ;
- un compte [Supabase](https://supabase.com/) ;
- un compte [Render](https://render.com/) ;
- Telegram et un bot créé avec [@BotFather](https://t.me/BotFather) ;
- un dépôt GitHub pour le déploiement Render.

## Installation locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sous PowerShell, remplacer la deuxième commande par :

```powershell
Copy-Item .env.example .env.local
```

Ouvrir ensuite <http://localhost:3000>. Les fonctions persistantes nécessitent que Supabase et les
variables ci-dessous soient configurés.

Commandes utiles :

```bash
npm run dev             # développement
npm run typecheck       # TypeScript strict
npm run lint            # ESLint
npm test                # tests Vitest
npm run test:e2e        # tests Playwright (navigateurs à installer une fois)
npm run db:validate     # cohérence schema/migration/Drizzle, seeds et garde-fous SQL
npm run build           # build de production
npm run start           # serveur de production, utilise PORT
npm run format:check    # contrôle Prettier
```

Installer les navigateurs Playwright une seule fois avant les tests E2E :

```bash
npx playwright install
```

## 1. Créer le projet Supabase

1. Aller sur [Supabase](https://supabase.com/dashboard), cliquer **New project**.
2. Choisir l’organisation, un nom, la région proche des utilisateurs et un mot de passe PostgreSQL
   fort. Conserver ce mot de passe dans un gestionnaire de secrets.
3. Cliquer **Create new project** et attendre la fin de l’initialisation.
4. Dans le projet, ouvrir **SQL Editor** puis **New query**.
5. Ouvrir localement [`supabase/schema.sql`](supabase/schema.sql), copier **tout** le fichier et le
   coller dans la requête.
6. Cliquer **Run**. Il n’est pas nécessaire de créer les tables une par une.
7. Dans **Table Editor**, vérifier notamment `users`, `entries`, `reviews`, `admin_messages`,
   `partners`, `audit_logs` et les tables de taxonomie.
   Le seed crée un auteur système et 20 fiches publiées marquées `is_demo`, afin que chaque
   catégorie contienne immédiatement deux exemples. Ces fiches sont exclues de l’XP et du
   classement des dresseurs.
8. Dans **Storage**, vérifier les buckets `entry-images`, `entry-drafts`, `partner-images`,
   `app-assets` et `message-attachments`. Le script SQL les crée avec limites et MIME autorisés.
   Les images proposées restent dans `entry-drafts` (privé) jusqu’à leur publication ; les pièces
   jointes restent également privées.
9. Si le script est relancé accidentellement, ses objets et seeds utilisent des garde-fous
   idempotents. Lire néanmoins le résultat SQL avant toute relance sur une base déjà utilisée.

### Récupérer les variables Supabase

Dans le tableau de bord, ouvrir **Project Settings → API** (ou le bouton **Connect**, selon
l’interface) :

- **Project URL** → `SUPABASE_URL` ;
- clé publique `anon` / publishable → `SUPABASE_ANON_KEY` ;
- clé secrète `service_role` → `SUPABASE_SERVICE_ROLE_KEY`.

La clé `service_role` contourne les politiques RLS : elle doit rester uniquement dans Render et
`.env.local`, jamais dans du code client ou une variable `NEXT_PUBLIC_*`.

Pour PostgreSQL, cliquer **Connect → Connection string** :

- copier l’URL du **Transaction pooler** dans `DATABASE_URL` (port 6543 en général) ;
- copier l’URL de connexion directe/session dans `DIRECT_DATABASE_URL` (port 5432 en général).

Remplacer le marqueur de mot de passe dans chaque URL. Render utilise `DATABASE_URL` ;
`DIRECT_DATABASE_URL` sert aux opérations SQL directes et peut nécessiter IPv6 selon le projet.

### Migrations futures

`supabase/schema.sql` représente toujours l’état complet. Toute modification ultérieure doit aussi
être ajoutée, dans l’ordre, sous `supabase/migrations/`. Pour une nouvelle installation, exécuter
uniquement `schema.sql`. Pour une installation existante, exécuter seulement les nouvelles
migrations après sauvegarde.

## 2. Créer et configurer le bot Telegram

1. Ouvrir [@BotFather](https://t.me/BotFather) dans Telegram.
2. Envoyer `/newbot`, choisir le nom visible puis un identifiant terminant par `bot`.
3. Copier le token dans `TELEGRAM_BOT_TOKEN`. Ne jamais le publier.
4. Renseigner le nom sans `@` dans `TELEGRAM_BOT_USERNAME`.
5. Envoyer `/mybots`, sélectionner le bot, puis **Bot Settings → Configure Mini App** et activer la
   Mini App. L’URL HTTPS Render sera ajoutée après le premier déploiement.
6. Ajouter le bot comme administrateur du canal de publication avec le droit de publier, puis placer
   `@nomducanal` ou son identifiant dans `TELEGRAM_CHANNEL_ID`.
7. Renseigner les URL publiques du canal, du chat et d’Instagram dans les variables correspondantes.

### Trouver les premiers identifiants admin

Avant d’installer le webhook, envoyer `/start` au bot puis appeler `getUpdates` avec le token stocké
dans une variable de terminal. La valeur `message.from.id` est l’identifiant à mettre dans
`TELEGRAM_OWNER_IDS` :

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"
```

Plusieurs identifiants se séparent par une virgule, sans espace. `TELEGRAM_OWNER_IDS` initialise les
propriétaires et `TELEGRAM_ADMIN_IDS` les administrateurs. Les autorisations sont ensuite également
conservées et relues en base ; masquer un bouton ne constitue jamais une sécurité.

### Générer les secrets

Exécuter cette commande trois fois et placer une valeur différente dans `SESSION_SECRET`,
`RATE_LIMIT_SECRET` et `TELEGRAM_WEBHOOK_SECRET` :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Variables d’environnement

Copier `.env.example` vers `.env.local` et compléter toutes les valeurs sensibles. Points importants :

- `NEXT_PUBLIC_APP_URL` : URL publique exacte, sans `/` final ;
- `APP_TIMEZONE` : fuseau IANA, par exemple `Europe/Zurich` ;
- `ENTRY_VIEW_DEDUP_HOURS` : fenêtre de déduplication des vues ;
- `TELEGRAM_AUTH_MAX_AGE_SECONDS` : ancienneté maximale acceptée pour `initData` Telegram ;
- `SESSION_MAX_AGE_SECONDS` : durée maximale d’une session applicative ;
- `AGE_GATE_ENABLED` et `MINIMUM_AGE` : avertissement d’âge ;
- `PORT` : utile localement. Sur Render, **ne pas le fixer** : Render injecte son propre `PORT` et
  `next start` le lit automatiquement.

Ne committer ni `.env.local`, ni token, ni URL PostgreSQL avec mot de passe.

## 4. Mettre le projet sur GitHub

Depuis le dossier `pokedex` :

```bash
git init
git add .
git commit -m "Initialiser le Pokédex communautaire"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/VOTRE-DEPOT.git
git push -u origin main
```

Créer d’abord un dépôt vide sur GitHub et remplacer l’URL. Vérifier avant le push que `.env.local`
n’apparaît pas dans `git status`.

## 5. Déployer sur Render

### Méthode recommandée : Blueprint

1. Dans Render, cliquer **New → Blueprint**.
2. Connecter GitHub si demandé et sélectionner le dépôt.
3. Vérifier que Render détecte [`render.yaml`](render.yaml), puis appliquer le Blueprint.
4. Dans les variables du service, compléter toutes les lignes marquées **sync: false**.
5. Laisser Render générer `SESSION_SECRET` et `RATE_LIMIT_SECRET`. Pour
   `TELEGRAM_WEBHOOK_SECRET`, renseigner manuellement la valeur hexadécimale générée plus haut :
   Telegram n’accepte pour ce secret que les caractères `A-Z`, `a-z`, `0-9`, `_` et `-`.
6. Lancer le déploiement. Render exécute `npm ci && npm run build`, puis `npm run start`.

Le Blueprint utilise l’instance `free` pour faciliter un premier essai. Elle peut se mettre en veille
après une période d’inactivité ; choisir une instance payante avant une ouverture publique si le
temps de réveil n’est pas acceptable.

### Méthode manuelle : Web Service

1. Cliquer **New → Web Service**, puis **Build and deploy from a Git repository**.
2. Connecter GitHub et choisir le dépôt.
3. Runtime : **Node** ; branche : `main`.
4. Build Command : `npm ci && npm run build`.
5. Start Command : `npm run start`.
6. Health Check Path : `/api/health`.
7. Ajouter chaque variable de `.env.example`, sauf `PORT` que Render fournit.
8. Cliquer **Create Web Service** et suivre les logs de build.

Après le premier déploiement :

1. Copier l’URL `https://…onrender.com`.
2. Mettre cette URL dans `NEXT_PUBLIC_APP_URL`.
3. Sauvegarder et déclencher **Manual Deploy → Deploy latest commit**, car une variable
   `NEXT_PUBLIC_*` est intégrée au build.
4. Ouvrir `https://…onrender.com/api/health`. La réponse attendue est :

```json
{ "status": "ok" }
```

Le health check ne renvoie aucune clé ni détail de connexion.

## 6. Installer le webhook et la Mini App

Avec les variables de production disponibles dans `.env.local`, exécuter :

```bash
npm run telegram:set-webhook
```

Le script :

- installe `https://VOTRE_URL/api/telegram/webhook` avec le secret Telegram ;
- enregistre `/start`, `/app`, `/search`, `/latest`, `/ranking`, `/profile`, `/partners`, `/help` et
  `/admin` ;
- configure le bouton de menu pour ouvrir la Mini App.

Dans @BotFather, retourner dans **/mybots → votre bot → Bot Settings → Configure Mini App** et
vérifier que la même URL HTTPS est enregistrée. Ensuite :

1. envoyer `/start` et vérifier l’image/menu d’accueil ;
2. toucher **Ouvrir le Pokédex** ;
3. vérifier les cinq onglets et les safe areas ;
4. envoyer `/admin` avec un compte autorisé puis avec un compte non autorisé ;
5. proposer une capture et un avis, puis valider le workflow admin ;
6. vérifier qu’un nouveau message utilisateur arrive uniquement aux admins, jamais dans le canal.

## Vérifications avant mise en ligne

```bash
npm run typecheck
npm run lint
npm test
npm run db:validate
npm run build
```

Vérifier aussi :

- qu’aucune vraie clé n’est suivie par Git ;
- que le bot est administrateur du canal uniquement avec les droits nécessaires ;
- que les buckets publics ne contiennent que des médias publiables ;
- que `message-attachments` est privé ;
- que les rôles sont corrects dans `users` ;
- que les pages légales correspondent au pays configuré avant ouverture publique ;
- que les sauvegardes Supabase et la surveillance Render sont activées selon le plan choisi.

## Dépannage rapide

- **401 dans la Mini App** : ouvrir depuis Telegram, pas depuis un navigateur normal ; vérifier
  l’heure du serveur et `TELEGRAM_BOT_TOKEN`.
- **Webhook refusé** : URL HTTPS publique, secret identique dans Render, puis relancer le script.
- **Connexion PostgreSQL** : utiliser le pooler dans `DATABASE_URL`, encoder les caractères spéciaux
  du mot de passe et conserver `sslmode=require`.
- **Upload refusé** : contrôler le MIME réel, la taille, le rôle et le bucket demandé.
- **Build Render échoue** : reproduire avec `npm ci` puis `npm run build` et vérifier Node 22.
- **Aucune publication canal** : vérifier `TELEGRAM_CHANNEL_ID` et le droit de publication du bot.

## Sécurité et signalement

Ne publier aucun secret dans une issue. Pour un incident, révoquer immédiatement le token concerné
(BotFather ou Supabase), remplacer la variable Render puis redéployer. Les pièces jointes aux
signalements restent dans le bucket privé et ne sont accessibles que par URL signée de courte durée.
