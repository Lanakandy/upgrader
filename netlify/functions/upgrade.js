export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) return new Response(JSON.stringify({ error: "Server API Key missing" }), { status: 500 });

  const MODEL_CASCADE = [
    "arcee-ai/trinity-large-preview:free", 
    "google/gemma-3-12b-it:free", 
    "tngtech/deepseek-r1t2-chimera:free",
    "google/gemini-2.0-flash-exp:free",        
    "openai/gpt-4o-mini"           
     
  ];

  try {
    // Added 'level' to the destructuring
    const { text, mode, customPrompt, task, level = 2 } = await req.json();

    let systemPrompt = "";
    let userMessage = "";

    if (task === 'define') {
      systemPrompt = "You are a Etymologist. Return ONLY a JSON object with 'definition' and 'nuance'.";
      userMessage = `Define "${text}" in context: "${context}".`;
    } 
    else {
      systemPrompt = `You are an expert Writing Coach. Return ONLY a JSON object with 'text' and 'reason'.
      
      RULES:
      1. PRESERVE MEANING: Do not change the core truth.
      2. REASON: Explain the linguistic shift (e.g. "Used stronger verb", "Added politeness marker").
      `;
      
      // --- LADDER LOGIC ---
      const sophisticatePrompts = {
        1: `
          TARGET: LEVEL 1 - POLISH (Professional/Polite).
          Goal: Make it sound competent, clear, and slightly more formal. suitable for a workplace email.
          Constraint: Keep grammar simple. Do not use obscure words.
          Example: "I'm really hungry" -> "I am feeling quite hungry at the moment."
        `,
        2: `
          TARGET: LEVEL 2 - RICH (Expressive/Journalistic).
          Goal: Use precise vocabulary and strong verbs. CEFR C1 Level.
          Constraint: Avoid generic words like 'very', 'big', 'good'.
          Example: "I'm really hungry" -> "I have a ravenous appetite."
        `,
        3: `
          TARGET: LEVEL 3 - LITERARY (Academic/Poetic).
          Goal: Complex syntax, metaphorical language, or high register. CEFR C2 Level.
          Constraint: Can use inversion or nominalization.
          Example: "I'm really hungry" -> "A profound hunger has seized me, impossible to ignore."
        `
      };

      const prompts = {
        // Use the ladder logic if mode is sophisticate
        'sophisticate': `DIRECTION: ELEVATE. ${sophisticatePrompts[level] || sophisticatePrompts[2]}`,
        
        'simplify': `
          DIRECTION: GROUND (Clarity).
          Goal: Punchy, modern, Hemingway style. Remove clutter. Use Anglo-Saxon roots.
          Example: "I am overcome by hunger" -> "I'm starving."
        `,
        
        'emotional': `
          DIRECTION: EXPAND (Nuance).
          Goal: Show, Don't Tell. Add sensory details or context. You may make the sentence longer.
          Example: "I'm hungry" -> "My stomach gave a hollow rumble; I hadn't eaten since dawn."
        `,
                     
        'custom': `Instruction: ${customPrompt || "Rewrite this."}`
      };

      userMessage = `Original Text: "${text}". 
      ${prompts[mode]}
      Constraint: Ensure distinct change. Do not loop.`;
    }

    // --- WATERFALL EXECUTION ---
    let lastError = null;
    for (const model of MODEL_CASCADE) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://gridscape.netlify.app",
            "X-Title": "Gridscape"
          },
          body: JSON.stringify({
            "model": model,
            "messages": [
              { "role": "system", "content": systemPrompt },
              { "role": "user", "content": userMessage }
            ],
            "temperature": 0.85,
            "response_format": { "type": "json_object" } 
          })
        });

        if (!response.ok) throw new Error(response.status);
        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) throw new Error("Empty response");
        return new Response(JSON.stringify(data), { status: 200 });

      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(lastError?.message);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};