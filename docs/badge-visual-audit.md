# Audit visuel des badges PokéTerps

Audit de production réalisé avant la collection V2. Les 19 slugs sont conservés et aucune attribution utilisateur n'est supprimée.

| Slug                   | Nom                     | Famille / condition        | Rareté     | Ancien asset                           | Attributions | Asset V2                    |
| ---------------------- | ----------------------- | -------------------------- | ---------- | -------------------------------------- | -----------: | --------------------------- |
| `role-owner`           | Propriétaire            | Rôle OWNER automatique     | Légendaire | `role-owner.png`                       |            1 | Emblème maître WebP         |
| `role-admin`           | Administration          | Rôle ADMIN automatique     | Épique     | `role-admin.png`                       |            1 | Console système WebP        |
| `role-moderator`       | Modération              | Rôle MODERATOR automatique | Rare       | `role-moderator.png`                   |            0 | Bouclier de validation WebP |
| `role-editor`          | Rédaction               | Rôle EDITOR automatique    | Succès     | Aucun                                  |            1 | Plume et fiche SVG          |
| `trainer-of-the-week`  | Dresseur de la semaine  | Rang hebdomadaire 1        | Succès     | Aucun                                  |            0 | Calendrier-éclair SVG       |
| `trainer-of-the-month` | Dresseur du mois        | Rang mensuel 1             | Succès     | Aucun                                  |            0 | Lune et lauriers SVG        |
| `capture-streak`       | Série de captures       | Série de 3 publications    | Succès     | Aucun                                  |            0 | Signal continu SVG          |
| `top-trainer`          | Top Dresseur            | Top 10 général             | Succès     | `top-trainer.png`                      |            0 | Trophée-lentille SVG        |
| `historic-contributor` | Contributeur historique | Contribution historique    | Succès     | `historic-contributor.png`             |            0 | Armoire d'archives SVG      |
| `first-review`         | Premier avis            | 1 avis publié              | Commun     | Réutilisait `level-1.png`              |            1 | Bulle et étoile SVG         |
| `captures-10`          | 10 captures             | 10 fiches publiées         | Peu commun | Réutilisait `level-5.png`              |            0 | Pile de fiches SVG          |
| `captures-50`          | 50 captures             | 50 fiches publiées         | Rare       | Réutilisait `level-10.png`             |            0 | Scanner à anneaux SVG       |
| `captures-100`         | 100 captures            | 100 fiches publiées        | Légendaire | Réutilisait `level-15.png`             |            0 | Sceau-vault SVG             |
| `contest-winner`       | Gagnant de concours     | Première victoire          | Épique     | `contest-winner.png`                   |            0 | Coupe étoilée SVG           |
| `level-1`              | Niveau 1                | Niveau 1 atteint           | Commun     | `level-1.png`                          |            4 | Lentille initiale SVG       |
| `level-5`              | Niveau 5                | Niveau 5 atteint           | Peu commun | `level-5.png`                          |            0 | Compas ailé SVG             |
| `level-10`             | Niveau 10               | Niveau 10 atteint          | Rare       | `level-10.png`                         |            1 | Radar double SVG            |
| `level-15`             | Niveau 15               | Niveau 15 atteint          | Légendaire | `level-15.png`                         |            0 | Porte des archives SVG      |
| `partner`              | Partenaire              | Partenariat actif          | Succès     | Réutilisait `historic-contributor.png` |            0 | Connecteurs liés SVG        |

## Direction artistique

- contours noirs épais, crème métallique, rouge Pokédex et accent dépendant de la rareté ;
- silhouette et symbole propres à chaque slug ;
- complexité croissante des cadres : cercle, hexagone, bouclier, étoile technique, sceau légendaire ;
- rôles OWNER/ADMIN/MODERATOR générés séparément avec l'outil d'image, puis optimisés en WebP transparent 512 px ;
- les 16 autres assets sont des SVG originaux légers (moins de 1,2 Ko chacun).
