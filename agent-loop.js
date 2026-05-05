
// agent-loop.js
import 'dotenv/config';

// Appel HTTP à l'API Mistral — factorisé pour éviter la répétition
async function callMistral(messages, tools) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({ model: 'mistral-small-latest', messages, tools, tool_choice: 'auto' })
  });
  if (!response.ok) {
    throw new Error(`Erreur Mistral API : ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/**
 * Boucle agentique — tourne jusqu'à finish_reason === 'stop'.
 * @param {Array}  tools         — définitions JSON Schema des outils
 * @param {Object} toolFunctions — { nomOutil: fn } pour l'exécution locale
 * @param {Array}  messages      — tableau muté en place (permet la mémoire de conversation)
 * @returns {string}             — réponse textuelle finale
 */
export async function runAgent(tools, toolFunctions, messages) {
  let iterations = 0;

  while (iterations < 20) {
    iterations++;
    const callStart = Date.now();
    const data = await callMistral(messages, tools);
    const choice = data.choices[0];

    console.log(`[Agent] Tour ${iterations} — ${data.usage?.total_tokens ?? '?'} tokens, ${Date.now() - callStart}ms`);

    // Toujours ajouter le message du modèle à l'historique (avec ou sans tool_calls)
    messages.push(choice.message);

    if (choice.finish_reason === 'stop') {
      return choice.message.content;
    }

    if (choice.finish_reason === 'tool_calls') {
      for (const toolCall of choice.message.tool_calls) {
        const fn = toolFunctions[toolCall.function.name];
        if (!fn) throw new Error(`Outil inconnu : ${toolCall.function.name}`);
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`  → ${toolCall.function.name}(${toolCall.function.arguments})`);
        const result = await fn(args);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }
  }

  throw new Error("[Agent] Nombre maximum d'itérations atteint");
}
 