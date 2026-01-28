export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) return new Response(JSON.stringify({ error: "Server API Key missing" }), { status: 500 });

  try {
    const { text, mode, customPrompt, task } = await req.json();

    let systemPrompt = "";
    let userMessage = "";

    // --- TASK 1: LEXICAL X-RAY (DEFINITION) ---
    if (task === 'define') {
      systemPrompt = "You are a dictionary. Return ONLY a JSON object with: 'definition' (max 15 words) and 'nuance' (max 10 words, explaining connotation).";
      userMessage = `Define the word "${text}" inside this context: "${context}".`;
    } 
    // --- TASK 2: UPGRADE (STANDARD & CUSTOM) ---
    else {
      systemPrompt = "You are a philologist. Return ONLY a JSON object with: 'text' (the upgraded sentence) and 'reason' (max 10 words academic explanation).";
      
      const prompts = {
        'sophisticate': "Rewrite to be more sophisticated, academic, and precise.",
        'simplify': "Rewrite to be punchier, simpler, and more direct.",
        'emotional': "Rewrite to focus on sensory details and emotional weight.",
        'action': "Rewrite to make verbs active and pacing faster.",
        'custom': customPrompt || "Rewrite this." // Use user input
      };

      userMessage = `${prompts[mode]}. Text: "${text}".`;
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gridscape.netlify.app",
        "X-Title": "Gridscape"
      },
      body: JSON.stringify({
        "model": "openai/gpt-4o-mini",
        "messages": [
          { "role": "system", "content": systemPrompt },
          { "role": "user", "content": userMessage }
        ],
        "response_format": { "type": "json_object" }
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};