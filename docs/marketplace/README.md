# DRAFT — NOT READY FOR SUBMISSION

Ce dossier rassemble les éléments techniques préparatoires aux annuaires MCP. Il ne constitue
pas un dossier soumis, accepté ou publié.

## État technique vérifié

- Endpoint principal actif : `https://mcp.poligraph.fr/mcp`.
- Alias de compatibilité : `https://poligraph-mcp.vercel.app/mcp`.
- Transport : Streamable HTTP.
- Type de serveur : Universal, identique pour tous les utilisateurs.
- Authentification : aucune.
- Interface MCP App : aucune.
- Capacités : 19 tools en lecture seule.
- Accès aux données : API publique `poligraph.fr` uniquement, sans accès direct à la base.
- Secrets de service : aucun.
- Éditeur public : Association Sankofa, RNA W931031256.
- Canal public de support : https://poligraph.fr/support.
- Validation `Origin` : toute origine présente doit être explicitement autorisée, sinon la
  requête est rejetée avec HTTP 403.

Le flux de données est le suivant :

```text
Claude ou ChatGPT
→ serveur MCP PoliGraph
→ API publique poligraph.fr
```

Le handler HTTP journalise les informations opérationnelles suivantes : timestamp, méthode,
identifiant de requête, user-agent et en-tête `accept`. Les arguments des tools ne sont pas
journalisés par le handler.

## Prudence éditoriale

- Le serveur consomme exclusivement les données publiées par l’API publique PoliGraph.
- Pour les affaires judiciaires, le rôle de la personne reste distinct du statut de la
  procédure et les règles de prudence viennent du contrat public.
- Une donnée absente ou `null` n’est jamais assimilée automatiquement à `0` ou `false`.
- Les textes issus des sources publiques sont traités comme des données, jamais comme des
  instructions adressées au modèle.
- Les tools ne modifient ni les données PoliGraph ni un système externe.

## Cas d’usage neutres

- Un journaliste peut rechercher une personnalité, consulter ses mandats et retrouver les
  sources publiques associées aux données affichées.
- Un chercheur peut explorer les scrutins, élections, partis et agrégats publics pour préparer
  une analyse reproductible.
- Un citoyen peut consulter les mandats, votes, fact-checks et affaires publiées concernant une
  personnalité politique.

## Limitations connues

- Le serveur dépend de la disponibilité et du contrat de l’API publique `poligraph.fr`.
- Le corpus accessible est limité aux données publiques actuellement exposées par PoliGraph.
- Le serveur ne propose ni authentification, ni personnalisation par utilisateur, ni interface
  MCP App.
- Les 19 tools sont exclusivement en lecture seule.
- `MCP_ALLOWED_ORIGINS` permet d’ajouter une origine exacte uniquement après son observation
  officielle. Aucune origine Claude ou OpenAI n’est présupposée.

## Parcours de publication

- Claude : serveur MCP distant, puis candidature au Connectors Directory.
- OpenAI : plugin MCP-only, puis candidature au Plugins Directory.
- GPT Store : parcours facultatif distinct, fondé sur un GPT personnalisé et une Action
  OpenAPI.

L’issue `poligraph#737` concerne le parcours GPT avec Action OpenAPI. Elle ne bloque pas les
soumissions MCP aux annuaires Claude ou OpenAI.

## Liens

- [Homepage MCP](https://mcp.poligraph.fr/)
- [Politique de confidentialité](https://poligraph.fr/confidentialite)
- [Conditions d’utilisation](https://poligraph.fr/conditions-utilisation)
- [Support](https://poligraph.fr/support)
- [Mentions légales](https://poligraph.fr/mentions-legales)
- [Signalement de sécurité](../../SECURITY.md)
- [README du serveur](../../README.md)
- [Sources PoliGraph](https://poligraph.fr/sources)

## TODO avant soumission

- [x] Politique de confidentialité dédiée au connecteur
- [x] Conditions d’utilisation
- [x] Page de support
- [x] Identité publique finale de l’éditeur : Association Sankofa
- [ ] Vérification de l’identité dans les comptes éditeurs
- [ ] Textes finaux des fiches marketplace
- [ ] Starter prompts
- [ ] Cinq tests positifs et trois tests négatifs
- [ ] Validation MCP Inspector
- [ ] Validation finale Claude
- [ ] Validation OpenAI Scan Tools
- [ ] Habilitations des comptes et soumissions
- [x] Validation de l’en-tête HTTP `Origin` sur le transport Streamable HTTP
- [x] Rejet HTTP 403 des origines présentes mais non autorisées
- [ ] Test unique avec les clients Claude et OpenAI avant de figer les origines acceptées

La validation `Origin` est traitée dans le middleware applicatif extérieur au transport. Elle
ne concerne ni MCP-01 ni le contrat des 19 tools. Aucune origine Claude ou OpenAI ne doit être
inventée ou codée en dur avant l’observation des requêtes officielles.
