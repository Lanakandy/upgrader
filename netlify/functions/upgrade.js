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
    const { text, mode, customPrompt, task, level = 2 } = await req.json();

    let systemPrompt = "";
    let userMessage = "";

    if (task === 'define') {
      systemPrompt = "You are a Etymologist. Return ONLY a JSON object with 'definition' and 'nuance'.";
      userMessage = `Define "${text}" in context: "${context}".`;
    } 
    else {
      systemPrompt = `You are an expert Applied Linguist and Writing Coach. Return ONLY a JSON object with 'text' and 'reason'.
      
      RULES:
      1. PRESERVE MEANING: Do not change the core truth (unless asking for expansion).
      2. REASON: Explain the linguistic shift (e.g. "Upgraded to C1 vocabulary", "Added sensory detail").
      `;
      
      // --- NEW LADDER LOGIC ---
      const sophisticatePrompts = {
        1: `
          TARGET: LEVEL 1 - PROFICIENCY BOOST (Vocabulary/Grammar).
          Goal: Keep the register/tone of the original (don't make it overly formal), but upgrade the vocabulary from A2/B1 to B2/C1.
          Mechanism: Use precise verbs and stronger collocations.
          Example: "I am really hungry" -> "I am famished." (Direct paraphrase, better word).
        `,
        2: `
          TARGET: LEVEL 2 - REGISTER SHIFT (Formal/Elevated).
          Goal: Shift the style to be more sophisticated, academic, or professional. 
          Mechanism: Use complex syntax (inversion, passive voice where appropriate) and high-register vocabulary.
          Example: "I am really hungry" -> "I am overcome by a ravenous appetite."
        `,
        3: `
          TARGET: LEVEL 3 - EXPANSION (Rich/Atmospheric).
          Goal: "Show, Don't Tell". Make the sentence richer, more emotional, or more vivid.
          Mechanism: You may increase the sentence length. Add sensory details or internal monologue.
          Example: "I am really hungry" -> "A hollow ache settled in my stomach; I hadn't eaten since dawn."
        `
      };

      const prompts = {
        'sophisticate': `DIRECTION: ELEVATE. ${sophisticatePrompts[level] || sophisticatePrompts[2]}`,
        
        'simplify': `
          DIRECTION: GROUND (Clarity).
          Goal: Punchy, modern, Hemingway style. Remove clutter. Use Anglo-Saxon roots.
          Example: "I am overcome by hunger" -> "I'm starving."
        `,
        
        // 'emotional' is removed as a mode, handled by Custom or Level 3
                     
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