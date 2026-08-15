# Poligraph MCP Server

Serveur [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) qui expose les données publiques de [Poligraph](https://poligraph.fr/) comme tools pour les clients MCP compatibles.

Permet aux journalistes, chercheurs et citoyens d'interroger des données documentées sur la vie politique française en langage naturel.

## Utilisation rapide

### Serveur distant

Le serveur HTTP Streamable est déployé à l'adresse :

```
https://poligraph-mcp.vercel.app/mcp
```

#### Claude Desktop

Ajoutez dans votre configuration MCP :

```json
{
  "mcpServers": {
    "poligraph": {
      "type": "streamable-http",
      "url": "https://poligraph-mcp.vercel.app/mcp"
    }
  }
}
```

#### Claude Code

```bash
claude mcp add poligraph --transport http https://poligraph-mcp.vercel.app/mcp
```

#### ChatGPT

La distribution ChatGPT est traitée séparément dans le lot MCP-04 afin de suivre le mécanisme OpenAI en vigueur au moment de la publication. Ce README ne documente volontairement plus l'ancienne procédure « Actions ».

Le serveur expose déjà les métadonnées MCP utiles aux clients compatibles :

- `annotations` avec `readOnlyHint: true` sur tous les tools ;
- `_meta` pour les états d'invocation ;
- `structuredContent` en complément du rendu textuel.

### Installation locale (stdio)

```bash
git clone https://github.com/ironlam/poligraph-mcp.git
cd poligraph-mcp
npm install
npm run build
```

Puis configurez votre client MCP pour exécuter :

```json
{
  "mcpServers": {
    "poligraph": {
      "command": "node",
      "args": ["/chemin/absolu/vers/poligraph-mcp/build/index.js"]
    }
  }
}
```

## Tools disponibles (19)

### Politiciens

| Tool | Description |
| --- | --- |
| `search_politicians` | Rechercher des personnalités publiées par nom, parti ou mandat |
| `get_politician` | Fiche publique : mandats, déclarations, fact-checks et compteurs judiciaires séparés par rôle |
| `get_politician_relations` | Relations publiques documentées par Poligraph |

### Affaires judiciaires

| Tool | Description |
| --- | --- |
| `list_affairs` | Affaires publiées avec filtres, rôle, sources et sémantique éditoriale canonique |
| `get_politician_affairs` | Affaires publiées d'une personnalité avec filtre de rôle |

### Votes parlementaires

| Tool | Description |
| --- | --- |
| `list_votes` | Scrutins parlementaires |
| `get_politician_votes` | Votes enregistrés et statistiques publiables d'un parlementaire |
| `get_vote_stats` | Cohésion, scrutins divisifs et statistiques globales |

### Mandats

| Tool | Description |
| --- | --- |
| `list_mandates` | Mandats publics ; les dates non vérifiées ne sont pas présentées comme ancienneté |

### Partis politiques

| Tool | Description |
| --- | --- |
| `list_parties` | Liste des partis avec filtres |
| `get_party` | Fiche publique : membres, filiation et classification documentée |

### Fact-checks

| Tool | Description |
| --- | --- |
| `list_factchecks` | Fact-checks publics issus des sources autorisées |
| `get_politician_factchecks` | Fact-checks publics mentionnant une personnalité |
| `get_factcheck_stats` | Statistiques agrégées du corpus public de fact-checks |

### Élections

| Tool | Description |
| --- | --- |
| `list_elections` | Élections françaises avec filtres |
| `get_election` | Candidatures, résultats et participation sans convertir les valeurs inconnues en faux |

### Géographie

| Tool | Description |
| --- | --- |
| `get_department_stats` | Statistiques sur les élus publiés par département |
| `get_deputies_by_department` | Députés publiés en exercice dans un département |

### Recherche

| Tool | Description |
| --- | --- |
| `search_advanced` | Recherche combinée sur le corpus public |

## Architecture

```text
src/
├── index.ts
├── server.ts
├── http.ts
├── api.ts                # client API borné : timeout, taille, erreurs
├── editorial.ts          # règles de rendu fail-safe du contrat public
├── tools/
│   ├── politicians.ts
│   ├── affairs.ts
│   ├── votes.ts
│   ├── legislation.ts
│   ├── factchecks.ts
│   ├── parties.ts
│   ├── elections.ts
│   ├── mandates.ts
│   └── departments.ts
└── tests/
    ├── editorial.test.ts
    └── api-contract.test.ts
api/
└── mcp.ts
```

**Transports supportés :**

- **stdio** pour un client local ;
- **HTTP Streamable** pour le serveur Express ou Vercel.

## Développement

```bash
npm run dev
npm run build
npm run start:http
npm run inspect
npm run test:unit
npm run test:contract
npm run test:build
```

`test:unit` vérifie les invariants éditoriaux déterministes. `test:contract` effectue le smoke test contre l'API publique déployée.

## Contrat éditorial public

Le MCP ne se connecte pas directement à la base de données et n'utilise ni service key ni endpoint d'administration. Il consomme exclusivement l'API publique Poligraph.

Pour les affaires judiciaires :

- seules les données publiées par le contrat public sont consommées ;
- le rôle (`DIRECT`, mention, victime, plaignant…) est distinct du statut de la procédure ;
- les libellés de statut, catégorie, prudence, certitude et maturité sont fournis par le contrat canonique Poligraph ;
- si cette sémantique canonique est absente, le MCP n'affiche pas le code interne comme signification éditoriale ;
- le total legacy `affairsCount`, qui mélange tous les rôles publiés, reste disponible uniquement pour compatibilité structurée et n'est pas présenté comme indicateur à charge ;
- les compteurs par rôle font foi pour la présentation.

Pour les données incomplètes :

- `null` ou champ absent ne signifie jamais `0` ou `false` ;
- un taux de participation n'est rendu que si son état de publication est explicitement `AVAILABLE` ;
- une date de prise de fonction n'est utilisée comme ancienneté que si le contrat la marque explicitement `AVAILABLE`.

Les champs textuels issus des sources publiques sont traités comme des **données**, jamais comme des instructions adressées au modèle.

## Sources

Poligraph agrège des sources publiques, institutionnelles et éditoriales documentées, notamment l'Assemblée nationale, le Sénat, la HATVP, Wikidata et des organismes de fact-checking. Voir [poligraph.fr/sources](https://poligraph.fr/sources) pour le détail.

## Licence

MIT
