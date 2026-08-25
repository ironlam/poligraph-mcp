DRAFT — NOT READY FOR SUBMISSION

# Brouillon OpenAI Plugins Directory

Ce document prépare une nouvelle soumission sans l’exécuter. Le parcours visé est le Plugins
Directory pour un plugin MCP-only. Le GPT Store constitue un parcours distinct, hors du
périmètre de ce lot.

## Type de soumission

- New submission
- With MCP
- Distribution : Plugins Directory
- Mode : MCP-only
- Type d’URL : Universal
- URL MCP : https://mcp.poligraph.fr/mcp
- Transport : Streamable HTTP
- Authentification : aucune
- Composant UI : aucun
- Captures requises pour ce périmètre MCP-only sans UI : non
- Enregistrement de démonstration : requis avant soumission, à produire et héberger

## Identité et listing

- Plugin name : PoliGraph
- Package name : `poligraph-mcp`
- Version : `2.0.0`
- Display name : PoliGraph
- Developer name : Association Sankofa
- Éditeur : Association Sankofa
- Registre : RNA W931031256
- Contact : contact@poligraph.fr

### Short description

> Données politiques sourcées

### Long description

> PoliGraph donne aux assistants compatibles MCP un accès en lecture seule à 19 outils fondés
> sur l’API publique poligraph.fr. Recherchez des personnalités politiques, leurs mandats et
> relations documentées, consultez les scrutins parlementaires, les partis, les élections, les
> statistiques territoriales et les fact-checks publiés. Les affaires judiciaires sont
> présentées avec le rôle de la personne, le statut de la procédure, les sources disponibles et
> les précautions nécessaires : une procédure en cours n’est jamais assimilée à une culpabilité.
> Aucun compte PoliGraph n’est requis. Le corpus peut être incomplet ou évoluer ; vérifiez les
> sources originales pour toute utilisation importante. PoliGraph ne fournit pas de conseil
> juridique et ne permet aucune modification de données.

## Capabilities

- Rechercher des personnalités politiques publiées
- Consulter des mandats et relations documentées
- Explorer des scrutins parlementaires
- Consulter des affaires judiciaires publiées
- Explorer élections, partis et territoires
- Consulter des fact-checks publiés

## Pages et asset

- Website : https://mcp.poligraph.fr/
- Support : https://poligraph.fr/support
- Privacy : https://poligraph.fr/confidentialite
- Terms : https://poligraph.fr/conditions-utilisation
- Mentions légales : https://poligraph.fr/mentions-legales
- Logo : assets/poligraph-icon-512.png

## Catégorie

La catégorie doit être sélectionnée humainement dans le portail. Concepts candidats :
Recherche, Éducation, Données publiques, Actualité et information. Ces concepts ne sont pas
présentés comme des valeurs garanties du portail.

## Starter prompts

1. Résume la fiche publique et les mandats d’Emmanuel Macron, avec les liens disponibles.
2. Liste cinq scrutins publiés avec date, résultat, voix et source.
3. Présente les affaires publiées concernant Nicolas Sarkozy avec rôle, statut, décisions et sources.

## Tests préparés

- Cinq tests positifs : fiche publique, scrutins, affaires judiciaires, territoires et
  fact-checks.
- Trois tests négatifs : tentative d’écriture, ciblage politique personnalisé, assimilation
  erronée entre affaire et culpabilité ou entre mention et mensonge.
- Source structurée : [test-cases.json](test-cases.json)
- Version humaine : [TEST_CASES.md](TEST_CASES.md)
- Statut : aucun test exécuté dans le portail officiel.

## Availability

- Statut : sélection humaine requise.
- Recommandation de travail : France en lancement initial.
- Motif : le corpus et les textes sont centrés sur la vie politique française.

## Release notes

> Première soumission publique de PoliGraph sous forme de plugin MCP-only. Le serveur expose 19
> tools en lecture seule pour consulter des données publiques et sourcées sur la vie politique
> française. Il utilise le transport Streamable HTTP, ne requiert aucune authentification et
> n’embarque aucune interface utilisateur.

## Domain verification et Scan Tools

- Le challenge de domaine doit être généré dans le portail.
- La valeur générée doit correspondre exactement au contenu déployé dans
  `/.well-known/openai-apps-challenge`.
- Aucune valeur de challenge n’est conservée dans ce dépôt.
- Scan Tools doit être exécuté après la saisie de l’URL.
- Les métadonnées et annotations doivent être relues dans le snapshot du portail.

## Enregistrement de démonstration

- Statut : `NEEDS_HUMAN_RECORDING_AND_HTTPS_URL`.
- URL : aucune valeur disponible dans cette passe.
- Document de préparation : [OPENAI_DEMO_RECORDING.md](OPENAI_DEMO_RECORDING.md).
- L’enregistrement et son URL HTTPS accessible aux reviewers sont requis avant la soumission.
- Cette exigence est distincte des captures d’interface, non requises puisque PoliGraph
  n’embarque aucune interface MCP.

## Annotations des tools

Les 19 tools exposent les valeurs runtime suivantes :

- `readOnlyHint: true` ;
- `destructiveHint: false` ;
- `openWorldHint: true`.

Les justifications sont préparées dans
[openai-tool-justifications.json](openai-tool-justifications.json). Le snapshot produit par Scan
Tools doit confirmer les valeurs et leur interprétation. Le runtime ne doit pas être modifié sur
la seule base d’une hypothèse. Si Scan Tools ou un reviewer conteste `openWorldHint` pour ce cas
de lecture de l’API publique, une clarification OpenAI doit être demandée avant toute correction.

## Checklist compte, identité et publication

- [ ] Organisation OpenAI Platform confirmée
- [ ] Identité professionnelle de l’Association Sankofa vérifiée
- [ ] Permission Apps Management: Write ou `api.apps.write` confirmée
- [ ] Projet OpenAI avec résidence globale confirmé
- [ ] Projet à résidence de données UE exclu de cette soumission
- [ ] Catégorie sélectionnée humainement
- [ ] Disponibilité géographique sélectionnée humainement
- [ ] Release notes validées humainement
- [ ] Challenge de domaine généré et vérifié dans le portail
- [ ] Enregistrement de démonstration créé et hébergé derrière une URL HTTPS accessible
- [ ] Scan Tools exécuté
- [ ] Snapshot des tools relu
- [ ] Valeurs et justifications des annotations confirmées
- [ ] Interprétation de `openWorldHint` confirmée
- [ ] Cinq tests positifs et trois tests négatifs exécutés officiellement
- [ ] Autorisation explicite de soumettre donnée par Lamine

## Étapes de publication

La création de la soumission, sa transmission et toute publication après acceptation restent
explicitement non exécutées.
