
// search-agent.js — Phase 3 : Web search + Météo + Calculatrice
// Trois outils disponibles simultanément — le modèle choisit et enchaîne sans instruction.
import 'dotenv/config';
import { runAgent } from './agent-loop.js';
import { calculateTool, calculate, weatherTool, get_weather, searchTool, web_search } from './tools.js';

const tools = [searchTool, weatherTool, calculateTool];
const toolFunctions = { web_search, get_weather, calculate };

// Devrait : appeler web_search d'abord, puis calculate pour les jours écoulés
const answer = await runAgent(
  tools,
  toolFunctions,
  [
    {
      role: 'system',
      content: "Réponds en texte brut, sans markdown. Pour calculer des jours écoulés, utilise une seule expression avec le nombre total de jours (ex: 365 + 366 + ...) en un seul appel calculate."
    },
    { role: 'user', content: "Quelle est la dernière version de Node.js, et combien de jours se sont écoulés depuis le 1er janvier 2024 ?" }
  ]
);

console.log('\nRéponse :', answer);
