DRAFT — NOT READY FOR SUBMISSION

# Brouillon Claude Connectors Directory

Ce document prépare des champs copiables. Il ne constate ni soumission, ni validation, ni
publication par Anthropic.

## Identité

- Nom du serveur : PoliGraph
- Éditeur : Association Sankofa
- Type : Association loi 1901
- Registre : RNA W931031256
- Contact : contact@poligraph.fr
- Site de l’organisation : https://poligraph.fr

Le nom comporte moins de 100 caractères.

## Endpoint et transport

- Type de soumission : Remote MCP
- Annuaire visé : Connectors Directory
- URL MCP : https://mcp.poligraph.fr/mcp
- Transport : Streamable HTTP
- Même URL pour tous les utilisateurs : oui
- Authentification : aucune

## Listing

### Tagline

> Données sourcées sur la vie politique française

La tagline comporte moins de 55 caractères.

### Description

> PoliGraph donne aux assistants compatibles MCP un accès en lecture seule à 19 outils fondés
> sur l’API publique poligraph.fr. Recherchez des personnalités politiques, leurs mandats et
> relations documentées, consultez les scrutins parlementaires, les partis, les élections, les
> statistiques territoriales et les fact-checks publiés. Les affaires judiciaires sont
> présentées avec le rôle de la personne, le statut de la procédure, les sources disponibles et
> les précautions nécessaires : une procédure en cours n’est jamais assimilée à une culpabilité.
> Aucun compte PoliGraph n’est requis. Le corpus peut être incomplet ou évoluer ; vérifiez les
> sources originales pour toute utilisation importante. PoliGraph ne fournit pas de conseil
> juridique et ne permet aucune modification de données.

La description comporte moins de 2 000 caractères.

## Cas d’usage

1. Rechercher une personnalité politique et retrouver sa fiche, ses mandats publiés et ses URLs
   publiques.
2. Examiner des scrutins parlementaires avec leur date, leur résultat, les répartitions de vote
   et leur source.
3. Explorer les élus, partis et statistiques de représentation par territoire.
4. Retrouver des fact-checks avec l’affirmation vérifiée, le verdict publié, la source et la
   date.
5. Consulter des affaires judiciaires publiées en distinguant le rôle de la personne, le statut
   procédural, les décisions éventuelles et les sources.

## Authentification et configuration utilisateur

- Authentification : aucune
- Compte PoliGraph requis : non
- Configuration propre à chaque utilisateur : non
- Compte de test requis : non
- Offre payante requise : non

## Données, hébergement et capacités

- Source : API publique poligraph.fr
- Accès direct à la base : non
- Secrets de service : aucun
- Nombre de tools : 19
- Classification : lecture seule
- Écriture dans un système externe : aucune
- Données de santé : non
- Contenu sponsorisé : non
- Interface embarquée : aucune
- Captures requises pour ce périmètre sans interface : non

## Documentation et pages publiques

- Documentation et homepage : https://mcp.poligraph.fr/
- Confidentialité : https://poligraph.fr/confidentialite
- Support : https://poligraph.fr/support
- Conditions d’utilisation : https://poligraph.fr/conditions-utilisation
- Mentions légales : https://poligraph.fr/mentions-legales
- Signalement de sécurité : ../../SECURITY.md
- Icône : assets/poligraph-icon-512.png

## Notes reviewer en anglais

> PoliGraph is a public, no-auth, read-only MCP server with 19 tools backed exclusively by the
> public poligraph.fr API. It supports research on French politicians, mandates, parliamentary
> votes, parties, elections, departmental representation, judicial affairs and fact-checks.
> Judicial information is role-aware and preserves procedural status, available sources and
> presumption-of-innocence safeguards. The server has no write capability and no embedded UI.

## Checklist compte et tests

- [ ] Organisation Claude Team ou Enterprise confirmée
- [ ] Rôle permettant la gestion du Directory confirmé
- [ ] Identité de l’Association Sankofa cohérente avec les pages publiques
- [ ] Chaque tool testé avec MCP Inspector ou un connecteur Claude personnalisé
- [ ] URL et listing revus dans le portail
- [ ] Test Claude officiel exécuté
- [ ] Autorisation explicite de soumettre donnée par Lamine

## Choix humains ouverts

- Slug candidat : `poligraph`, sous réserve de sélection humaine et de disponibilité.
- Catégories à sélectionner dans le portail. Concepts candidats : Recherche, Éducation, Données
  publiques, Information. Ces libellés ne sont pas présentés comme des valeurs garanties du
  portail.
- Validation humaine finale de la fiche.
- Autorisation explicite avant toute soumission.

Statut de toutes les étapes de portail : non exécutées.
