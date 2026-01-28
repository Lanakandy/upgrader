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
    // --- TASK 2: UPGRADE (DIRECTIONAL LADDER LOGIC) ---
    else {
      systemPrompt = "You are a Philology Engine. Your goal is to move text along a specific vector (Formality, Complexity, Emotion). You must avoid loops. Return ONLY a JSON object with: 'text' (the upgraded sentence) and 'reason' (max 10 words academic explanation).";
      
      const prompts = {
        'sophisticate': "VECTOR: INCREASE FORMALITY. Analyze the current register. The output must be strictly MORE formal/academic than the input. Do not swap for a synonym of equal weight (e.g., do not swap 'glad' for 'happy'). You must climb the ladder one distinct step.",
        
        'simplify': "VECTOR: DECREASE COMPLEXITY. Analyze the current register. The output must be strictly SIMPLER/PLAINER than the input. Strip away adornment. Use Anglo-Saxon roots over Latin ones.",
        
        'emotional': "VECTOR: INCREASE INTENSITY. Analyze the current emotional weight. The output must evoke a STRONGER sensory or emotional response. Move from 'telling' to 'showing'.",
        
        'action': "VECTOR: INCREASE MOMENTUM. Make the verbs stronger and the sentence structure more propulsive.",
        
        'custom': customPrompt || "Rewrite this."
      };

      userMessage = `Current Text: "${text}". 
      Instruction: ${prompts[mode]}. 
      Constraint: The change must be noticeable and directional. If the mode is 'sophisticate', the result MUST be more complex than the input. Do not loop.`;
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
        // Increased from 0.7 to 0.85 to break deterministic loops
        "temperature": 0.85, 
        "response_format": { "type": "json_object" }
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};