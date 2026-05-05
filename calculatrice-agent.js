// calculatrice-agent.js
import 'dotenv/config';


// --- Définition de l'outil ---
const tools = [
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Évalue une expression mathématique et retourne le résultat. Utiliser pour tout calcul arithmétique.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: "L'expression à évaluer, ex: '(15 * 4) / 3' ou '2 ** 32'"
          }
        },
        required: ['expression']
      }
    }
  }
];

// --- Implémentation de l'outil ---
function calculate(expression) {
  // Valider que l'expression ne contient que des caractères arithmétiques
  if (!/^[\d\s+\-*/%.()\*\*]+$/.test(expression)) {
    throw new Error(`Expression invalide : caractères non autorisés → "${expression}"`);
  }
  return Function('"use strict"; return (' + expression + ')')();
}

// --- L'appel au LLM avec les outils activés ---
async function callWithTools(userMessage) {
  const messages = [
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages,
      tools,          // on passe la liste des outils
      tool_choice: 'auto' // le modèle décide s'il utilise un outil ou pas
    })
  });

  const data = await response.json();
  let choice = data.choices[0];

  // Boucle pour gérer les appels d'outils successifs
  while (choice.finish_reason === 'tool_calls') {
    const toolCalls = choice.message.tool_calls;

    // Ajouter le message assistant (avec ses tool_calls) à l'historique
    messages.push(choice.message);

    // Exécuter chaque outil demandé
    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments);
      let result;
      if (toolCall.function.name === 'calculate') {
        result = calculate(args.expression);
      } else {
        result = `Outil inconnu : ${toolCall.function.name}`;
      }
      console.log(`  → calculate(${args.expression}) = ${result}`);

      // Renvoyer le résultat au LLM
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: String(result)
      });
    }

    // Nouvel appel au LLM pour qu'il formule la réponse finale
    const response2 = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        tools,
        tool_choice: 'auto'
      })
    });

    const data2 = await response2.json();
    choice = data2.choices[0];
  }

  console.log('Réponse finale :', choice.message.content);
}

callWithTools('Combien fait 2 à la puissance 32 ? Et 15 fois 24 ?');

 