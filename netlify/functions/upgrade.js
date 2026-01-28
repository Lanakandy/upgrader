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
    // --- TASK 2: UPGRADE (INCREMENTAL LADDER LOGIC) ---
    else {
      // KEY CHANGE: We instruct the System to be an "Incremental Engine"
      systemPrompt = "You are a Nuance Engine. You modify text in small, incremental steps. Avoid archaic language, 'purple prose', or over-the-top exaggerations. Return ONLY a JSON object with: 'text' (the upgraded sentence) and 'reason' (max 10 words academic explanation).";
      
      const prompts = {
        'sophisticate': "Rewrite this to be slightly more formal and precise. Do not make it overly poetic or archaic. Just take it one step up the academic ladder.",
        
        'simplify': "Rewrite this to be slightly more casual and direct. Do not make it childish. Just strip away one layer of complexity.",
        
        'emotional': "Rewrite this to add a specific sensory detail or a slight emotional color. Do not turn it into a melodrama. Just make it feel more human.",
        
        'action': "Rewrite this to make the verb slightly stronger. Change passive voice to active if present. Increase the momentum just a bit.",
        
        'custom': customPrompt || "Rewrite this."
      };

      // KEY CHANGE: We explicitly tell the AI to compare against the input
      userMessage = `Current Text: "${text}". 
      Instruction: ${prompts[mode]}. 
      Constraint: The change must be noticeable but natural. Do not change the meaning, only the register.`;
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
        "model": "openai/gpt-4o-mini", // GPT-4o-mini is great at following "nuance" instructions
        "messages": [
          { "role": "system", "content": systemPrompt },
          { "role": "user", "content": userMessage }
        ],
        "temperature": 0.7, // Slightly lower temperature keeps it grounded
        "response_format": { "type": "json_object" }
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};