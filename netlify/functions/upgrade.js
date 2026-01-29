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
      systemPrompt = "You are a Etymologist and Lexicographer. Return ONLY a JSON object with: 'definition' (concise, max 15 words) and 'nuance' (max 10 words, explaining the specific flavor, connotation, or register of the word).";
      userMessage = `Define the word "${text}" as it is used in this specific context: "${context}".`;
    } 
    // --- TASK 2: UPGRADE (LINGUISTIC EVOLUTION) ---
    else {
      systemPrompt = `You are an expert Applied Linguist and Writing Coach. 
      Your goal is to rewrite user text to help language learners understand different registers and styles.
      
      CRITICAL RULES:
      1. PRESERVE MEANING: Do not change the fundamental truth of the sentence.
      2. EDUCATIONAL VALUE: The 'reason' field must explain the *linguistic mechanism* used (e.g., "Used a participial phrase," "Nominalization for weight," "Specific sensory detail").
      3. OUTPUT FORMAT: Return ONLY a JSON object with: 'text' (the rewritten sentence) and 'reason' (max 15 words).`;
      
      const prompts = {
        // GOAL: CEFR C1/C2 Level - High Register
        'sophisticate': `
          DIRECTION: ELEVATE (ACADEMIC/LITERARY).
          Target: CEFR C1/C2 Proficiency.
          Mechanism: 
          1. Syntactic Complexity: Use subordination, inversion, or participial phrases instead of simple subject-verb structures.
          2. Lexical Precision: Replace generic verbs (get, do, make) with precise verbs.
          3. Tone: Authoritative and refined.
          Example: "I am really hungry" -> "I am overcome by a ravenous appetite." or "A profound hunger has seized me."
        `,
        
        // GOAL: Clarity, Conciseness, Natural Flow
        'simplify': `
          DIRECTION: GROUND (CLARITY/DIRECTNESS).
          Target: Natural, punchy, modern prose (Hemingway style).
          Mechanism:
          1. Remove unnecessary modifiers and adjectives.
          2. Unpack complex grammar into direct Subject-Verb-Object structures.
          3. Choose strong, simple Anglo-Saxon roots over Latinate words.
          4. If the input is already simple, make it *idiomatic* and conversational.
          Example: "I am overcome by a ravenous appetite" -> "I'm starving."
        `,
        
        // GOAL: Show Don't Tell, Sensory Detail, Context
        'emotional': `
          DIRECTION: NUANCE & EXPANSION.
          Target: Creative Non-Fiction / Novelist style.
          Mechanism:
          1. "Show, Don't Tell": Don't say the emotion; describe the physical sensation or the environment.
          2. Add Detail: Introduce a specific detail that implies the context.
          3. Expand: You are allowed to make the sentence longer to add this depth.
          Example: "I am really hungry" -> "My stomach gave a hollow rumble, reminding me I hadn't eaten since dawn."
        `,
                     
        'custom': `Instruction: ${customPrompt || "Rewrite this."}`
      };

      userMessage = `Original Text: "${text}". 
      ${prompts[mode]}
      
      Final Constraint: Ensure the output is distinctly different from the input. Do not loop.`;
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
        "model": "openai/gpt-4o-mini", // GPT-4o-mini is excellent for this, but Claude-3-Haiku is also great for creative nuance if you switch models.
        "messages": [
          { "role": "system", "content": systemPrompt },
          { "role": "user", "content": userMessage }
        ],
        "temperature": 0.9, // Higher temperature for more creative linguistic variety
        "response_format": { "type": "json_object" }
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};