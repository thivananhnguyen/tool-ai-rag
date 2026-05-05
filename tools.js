// tools.js — Définitions et implémentations des outils partagés entre tous les agents
import 'dotenv/config';
import { evaluate } from 'mathjs';

// ─── Calculatrice ──────

export const calculateTool = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Évalue une expression mathématique et retourne le résultat numérique. À utiliser pour tout calcul arithmétique : additions, multiplications, puissances, conversions, etc.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: "L'expression mathématique à évaluer, ex: '2 ^ 32', '(15 * 4) / 3', '(12 * 9/5) + 32'"
        }
      },
      required: ['expression']
    }
  }
};

// mathjs.evaluate est sûr : il n'exécute pas de code arbitraire (contrairement à eval)
export function calculate({ expression }) {
  try {
    const result = evaluate(expression);
    return { result };
  } catch (err) {
    return { error: `Expression invalide : ${err.message}` };
  }
}

// ─── Météo ───────────────

export const weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Récupère la météo actuelle pour une ville donnée. Utiliser quand on parle de météo, température, conditions climatiques.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: "Le nom de la ville (ex: 'Paris', 'London', 'Tokyo')"
        }
      },
      required: ['city']
    }
  }
};

export async function get_weather({ city }) {
  const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
  if (!response.ok) {
    return { error: `Impossible de récupérer la météo pour ${city}` };
  }
  const data = await response.json();
  const current = data.current_condition[0];
  return {
    city,
    temperature_c: current.temp_C,
    feels_like_c: current.FeelsLikeC,
    description: current.weatherDesc[0].value,
    humidity: current.humidity + '%',
    wind_kmph: current.windspeedKmph
  };
}

// ─── Recherche web ──────

export const searchTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: "Recherche des informations récentes sur le web. Utiliser pour des faits actuels, des événements récents, des données en temps réel, ou quand on n'est pas certain d'une information.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La requête de recherche, en anglais pour de meilleurs résultats'
        }
      },
      required: ['query']
    }
  }
};

export async function web_search({ query }) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (educational project)' }
  });
  if (!response.ok) {
    return { error: `Erreur DuckDuckGo : ${response.status}` };
  }
  const data = await response.json();

  const topics = (data.RelatedTopics || [])
    .filter(t => t.Text)
    .slice(0, 5)
    .map(t => ({ text: t.Text, url: t.FirstURL }));

  if (topics.length > 0) return topics;
  if (data.AbstractText) return [{ text: data.AbstractText, url: data.AbstractURL }];
  return { message: 'Aucun résultat trouvé.' };
}
