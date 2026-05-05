// tools.js — Définitions et implémentations des outils partagés entre tous les agents
import 'dotenv/config';
import { evaluate } from 'mathjs';
import validator from 'validator';

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
  if (!expression || typeof expression !== 'string' || validator.isEmpty(expression.trim())) {
    return { error: 'Expression invalide : doit être une chaîne non vide.' };
  }
  if (!validator.isLength(expression.trim(), { min: 1, max: 500 })) {
    return { error: 'Expression invalide : trop longue (max 500 caractères).' };
  }
  try {
    const result = evaluate(validator.trim(expression));
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
  if (!city || typeof city !== 'string' || validator.isEmpty(city.trim())) {
    return { error: 'Ville invalide : doit être une chaîne non vide.' };
  }
  const sanitizedCity = validator.trim(city);
  if (!validator.isLength(sanitizedCity, { min: 1, max: 100 })) {
    return { error: 'Nom de ville invalide : trop long (max 100 caractères).' };
  }
  if (!validator.matches(sanitizedCity, /^[\p{L}\s\-'.]+$/u)) {
    return { error: 'Nom de ville invalide : caractères non autorisés.' };
  }

  const response = await fetch(`https://wttr.in/${encodeURIComponent(sanitizedCity)}?format=j1`);
  if (!response.ok) {
    return { error: `Impossible de récupérer la météo pour ${sanitizedCity}` };
  }
  const data = await response.json();
  const current = data.current_condition[0];
  return {
    city: sanitizedCity,
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

// Cache en mémoire pour web_search — évite de rappeler DuckDuckGo pour la même query
const searchCache = new Map();

export async function web_search({ query }) {
  if (!query || typeof query !== 'string' || validator.isEmpty(query.trim())) {
    return { error: 'Requête invalide : query doit être une chaîne non vide.' };
  }
  const q = validator.trim(validator.stripLow(query)).slice(0, 200); // stripLow retire les caractères de contrôle

  if (searchCache.has(q)) {
    console.log(`  [cache] web_search("${q}")`);
    return searchCache.get(q);
  }

  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (educational project)' }
  });
  if (!response.ok) {
    return { error: `Erreur DuckDuckGo : ${response.status}` };
  }
  const data = await response.json();

  const results = (data.RelatedTopics || [])
    .filter(t => t.Text)
    .slice(0, 5)
    .map(t => ({ text: t.Text, url: t.FirstURL }));

  if (results.length === 0 && data.AbstractText) {
    return [{ text: data.AbstractText, url: data.AbstractURL }];
  }
  const output = results.length > 0 ? results : { message: 'Aucun résultat trouvé.' };
  searchCache.set(q, output); // mise en cache
  return output;
}

// ─── Lecture de page web ─────────────────────────────────────────────────────

export const fetchPageTool = {
  type: 'function',
  function: {
    name: 'fetch_page',
    description: "Récupère et lit le contenu textuel d'une page web à partir de son URL. Utiliser après web_search pour approfondir un résultat et obtenir des détails précis.",
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: "L'URL complète de la page à lire (ex: 'https://nodejs.org/en/blog/...')"
        }
      },
      required: ['url']
    }
  }
};

// ─── Validation SSRF ─────────────────────────────────────────────────────────
// validator.isURL vérifie le format et le protocole.
// La vérification des plages IP privées reste nécessaire car validator ne la fait pas nativement.
const PRIVATE_IP_RANGES = [
  /^10\./,                          // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,    // 172.16.0.0/12
  /^192\.168\./,                    // 192.168.0.0/16
  /^127\./,                         // 127.0.0.0/8 loopback
  /^169\.254\./,                    // 169.254.0.0/16 link-local / metadata cloud
  /^0\./,                           // 0.0.0.0/8
  /^::1$/,                          // IPv6 loopback
  /^fe80/i,                         // IPv6 link-local
];

function assertSafeUrl(rawUrl) {
  // validator.isURL : protocole restreint à http/https, pas d'auth user:pass, TLD requis
  const isValidUrl = validator.isURL(rawUrl, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: true,
    disallow_auth: true,       // interdit user:pass@host
    allow_query_components: true
  });
  if (!isValidUrl) {
    throw new Error('URL invalide ou protocole non autorisé.');
  }

  // Vérification anti-SSRF sur les plages IP privées
  const host = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '0.0.0.0') {
    throw new Error('Accès aux ressources locales interdit.');
  }
  if (PRIVATE_IP_RANGES.some(re => re.test(host))) {
    throw new Error('Accès aux adresses IP privées/internes interdit (SSRF).');
  }
}

export async function fetch_page({ url }) {
  if (!url || typeof url !== 'string' || validator.isEmpty(url.trim())) {
    return { error: 'URL invalide : doit être une chaîne non vide.' };
  }
  const cleanUrl = validator.trim(url);
  try {
    assertSafeUrl(cleanUrl);
  } catch (err) {
    return { error: `URL refusée : ${err.message}` };
  }

  const response = await fetch(cleanUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (educational project)' }
  });
  if (!response.ok) {
    return { error: `Impossible de lire la page : ${response.status}` };
  }
  const html = await response.text();

  // Extraction brutale du texte : on retire les balises HTML
  // Pour un vrai projet : utiliser cheerio ou node-html-parser
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000); // on limite pour ne pas saturer le contexte

  return { url: cleanUrl, content: text };
}
