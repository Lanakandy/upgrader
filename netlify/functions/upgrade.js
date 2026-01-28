export default async (req, context) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Get the secret key from Netlify Environment Variables
  const API_KEY = process.env.OPENROUTER_API_KEY;

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "Server API Key missing" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" } 
    });
  }

  try {
    const { text, mode, context } = await req.json();

    // Define the prompt logic securely on the server
    const prompts = {
      'sophisticate': "Rewrite this to be more sophisticated, academic, and precise.",
      'simplify': "Rewrite this to be punchier, simpler, and more direct.",
      'emotional': "Rewrite this to focus on the sensory details and emotional weight.",
      'action': "Rewrite this to make the verbs more active and the pacing faster.",
    };

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
          {
            "role": "system",
            "content": "You are a philologist and editor. Return ONLY a JSON object with two fields: 'text' (the upgraded sentence) and 'reason' (a very brief, max 10-word academic explanation of WHY this change improves the nuance)."
          },
          {
            "role": "user",
            "content": `${prompts[mode]}. Text: "${text}". Context from previous node: "${context || 'None'}"`
          }
        ],
        "response_format": { "type": "json_object" }
      })
    });

    const data = await response.json();
    
    // Pass the OpenRouter response back to your frontend
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};