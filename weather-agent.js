
// weather-agent.js
import 'dotenv/config';
import { runAgent } from './agent-loop.js';

// --- Outil météo ---
const weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Récupère la météo actuelle pour une ville donnée. Utiliser quand on parle de météo, température, conditions climatiques.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: "Le nom de la ville, en anglais de préférence (ex: 'Paris', 'London', 'Tokyo')"
        }
      },
      required: ['city']
    }
  }
};

// --- Implémentation de l'outil ---
async function get_weather({ city }) {
  // wttr.in : API météo publique, format JSON, aucune clé requise
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

// --- Agent qui combine calculatrice + météo ---
const tools = [weatherTool /*, calculatorTool */];
const toolFunctions = {
  get_weather
  // calculate: ...
};

// Test 1 : météo dans deux villes simultanément
const reponse1 = await runAgent(tools, toolFunctions, 'Quelle est la météo à Paris et à Tokyo en ce moment ?');
console.log('\nRéponse 1 :', reponse1);

// Test 2 : conseil vestimentaire basé sur la météo
const reponse2 = await runAgent(tools, toolFunctions, 'Il fait combien à Lyon ? Est-ce qu\'il faut un manteau ?');
console.log('\nRéponse 2 :', reponse2);