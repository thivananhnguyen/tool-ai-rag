
// agent-loop.js
import 'dotenv/config';

export async function runAgent(tools, toolFunctions, userMessage) {
  const messages = [
    { role: 'user', content: userMessage }
  ];

  let iterations = 0;

  // La boucle : on tourne jusqu'à ce que le modèle dise "stop"
  while (iterations < 10) {
    iterations++;
    const callStart = Date.now();

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
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

    const data = await response.json();
    const choice = data.choices[0];

    // Métriques observables : tokens consommés et latence de ce tour
    console.log(`[Agent] Tour ${iterations} — ${data.usage?.total_tokens ?? '?'} tokens, ${Date.now() - callStart}ms`);

    // On ajoute la réponse du modèle à l'historique (avec ou sans tool_calls)
    messages.push(choice.message);

    if (choice.finish_reason === 'stop') {
      // Le modèle a fini, on retourne la réponse textuelle
      return choice.message.content;
    }

    if (choice.finish_reason === 'tool_calls') {
      // Le modèle veut appeler des outils — potentiellement plusieurs à la fois
      for (const toolCall of choice.message.tool_calls) {
        const fn = toolFunctions[toolCall.function.name];
        const args = JSON.parse(toolCall.function.arguments);

        // On exécute l'outil
        const result = await fn(args);

        // On renvoie le résultat au modèle sous forme de message "tool"
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id, // l'ID est important pour matcher l'appel
          content: JSON.stringify(result)
        });
      }
      // La boucle repart : le modèle reçoit les résultats et décide quoi faire
    }
  }
}
 