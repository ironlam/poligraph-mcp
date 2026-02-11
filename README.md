# Transparence Politique MCP Server

Serveur [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) qui expose les données de [Transparence Politique](https://politic-tracker.vercel.app/) comme tools pour Claude Desktop et Claude Code.

Permet aux journalistes, chercheurs et citoyens de requêter les données politiques françaises en langage naturel.

## Installation

```bash
git clone https://github.com/ironlam/transparence-politique-mcp.git
cd transparence-politique-mcp
npm install
npm run build
```

## Configuration Claude Desktop

Ajoutez dans votre fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "transparence-politique": {
      "command": "node",
      "args": ["/chemin/absolu/vers/transparence-politique-mcp/build/index.js"]
    }
  }
}
```

**Emplacement du fichier de config :**
- macOS : `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows : `%APPDATA%\Claude\claude_desktop_config.json`
- Linux : `~/.config/Claude/claude_desktop_config.json`

## Configuration Claude Code

Ajoutez dans `.claude/settings.json` :

```json
{
  "mcpServers": {
    "transparence-politique": {
      "command": "node",
      "args": ["/chemin/absolu/vers/transparence-politique-mcp/build/index.js"]
    }
  }
}
```

## Tools disponibles

### `search_politicians`
Rechercher des politiciens par nom, parti ou type de mandat.

```
Qui sont les députés du Rassemblement National ?
Liste les sénateurs ayant des affaires judiciaires
```

### `get_politician`
Fiche complète d'un politicien : mandats, déclarations de patrimoine, affaires.

```
Donne-moi la fiche d'Emmanuel Macron
Quels mandats a exercé Marine Le Pen ?
```

### `get_politician_affairs`
Affaires judiciaires d'un politicien avec sources et détails.

```
Quelles sont les affaires de Nicolas Sarkozy ?
```

### `get_politician_votes`
Votes d'un parlementaire avec statistiques de participation.

```
Comment vote Jean-Luc Mélenchon ?
Quel est le taux de participation de ce député ?
```

### `list_affairs`
Liste des affaires judiciaires avec filtres (statut, catégorie).

```
Quelles affaires de corruption sont en cours ?
Liste les condamnations définitives
```

### `list_votes`
Scrutins parlementaires (Assemblée nationale et Sénat).

```
Quels votes ont eu lieu sur l'immigration ?
Liste les scrutins rejetés de la 17e législature
```

### `get_vote_stats`
Statistiques de vote par parti : cohésion, scrutins divisifs.

```
Quel parti est le plus cohérent dans ses votes ?
Quels sont les scrutins les plus divisifs au Sénat ?
```

### `search_advanced`
Recherche avancée avec filtres combinés (département, statut actif, etc.).

```
Quels sont les députés actifs de Paris ayant des affaires ?
Trouve les ministres du parti socialiste
```

## Développement

```bash
npm run dev          # Compilation en mode watch
npm run build        # Build production
npm run inspect      # Tester interactivement avec MCP Inspector
```

## Source des données

Toutes les données proviennent de sources officielles :
- [Assemblée nationale](https://data.assemblee-nationale.fr/)
- [Sénat](https://data.senat.fr/)
- [HATVP](https://www.hatvp.fr/)
- [Wikidata](https://www.wikidata.org/)

Voir [politic-tracker.vercel.app/sources](https://politic-tracker.vercel.app/sources) pour la liste complète.

## Licence

MIT
