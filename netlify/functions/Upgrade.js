export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) return new Response(JSON.stringify({ error: "Server API Key missing" }), { status: 500 });

  // --- MODEL WATERFALL STRATEGY ---
  // The function will try these in order. If one fails, it moves to the next.
  const MODEL_CASCADE = [
    "arcee-ai/trinity-large-preview:free", 
    "google/gemma-3-12b-it:free", 
    "tngtech/deepseek-r1t2-chimera:free",
    "google/gemini-2.0-flash-exp:free",        
    "openai/gpt-4o-mini"           
      ];

  try {
    const { text, mode, customPrompt, task } = await req.json();

    let systemPrompt = "";
    let userMessage = "";

    // --- PROMPT CONSTRUCTION (Refined for "Writing Coach" Persona) ---
    if (task === 'define') {
      systemPrompt = "You are a Etymologist and Lexicographer. Return ONLY a JSON object with: 'definition' (concise, max 15 words) and 'nuance' (max 10 words, explaining the specific flavor, connotation, or register of the word).";
      userMessage = `Define the word "${text}" as it is used in this specific context: "${context}".`;
    } 
    else {
      systemPrompt = `You are an expert Applied Linguist and Writing Coach. 
      Your goal is to rewrite user text to help language learners understand different registers and styles.
      
      CRITICAL RULES:
      1. PRESERVE MEANING: Do not change the fundamental truth of the sentence.
      2. EDUCATIONAL VALUE: The 'reason' field must explain the *linguistic mechanism* used (e.g., "Used a participial phrase," "Nominalization for weight," "Specific sensory detail").
      3. OUTPUT FORMAT: Return ONLY a JSON object with: 'text' (the rewritten sentence) and 'reason' (max 15 words).`;
      
      const prompts = {
        'sophisticate': `
          DIRECTION: ELEVATE (ACADEMIC/LITERARY).
          Target: CEFR C1/C2 Proficiency.
          Mechanism: 
          1. Syntactic Complexity: Use subordination, inversion, or participial phrases.
          2. Lexical Precision: Replace generic verbs with precise ones.
          3. Tone: Authoritative and refined.
          Example: "I am really hungry" -> "I am overcome by a ravenous appetite."
        `,
        'simplify': `
          DIRECTION: GROUND (CLARITY/DIRECTNESS).
          Target: Natural, punchy, modern prose (Hemingway style).
          Mechanism:
          1. Remove unnecessary modifiers.
          2. Unpack complex grammar into direct Subject-Verb-Object structures.
          3. Use strong Anglo-Saxon roots.
          Example: "I am overcome by a ravenous appetite" -> "I'm starving."
        `,
        'emotional': `
          DIRECTION: NUANCE & EXPANSION.
          Target: Creative Non-Fiction / Novelist style.
          Mechanism:
          1. "Show, Don't Tell": Describe the physical sensation or environment.
          2. Add Detail: Introduce a specific detail that implies the context.
          3. Expand: You are allowed to make the sentence longer to add depth.
          Example: "I am really hungry" -> "My stomach gave a hollow rumble, reminding me I hadn't eaten since dawn."
        `,
        'custom': `Instruction: ${customPrompt || "Rewrite this."}`
      };

      userMessage = `Original Text: "${text}". 
      ${prompts[mode]}
      Final Constraint: Ensure the output is distinctly different from the input. Do not loop.`;
    }

    // --- EXECUTE WATERFALL REQUEST ---
    let lastError = null;

    for (const model of MODEL_CASCADE) {
      try {
        console.log(`Attempting model: ${model}...`);
        
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
            "temperature": 0.9,
            "response_format": { "type": "json_object" } 
          })
        });

        if (!response.ok) {
          throw new Error(`Model ${model} responded with ${response.status}`);
        }

        const data = await response.json();
        
        // Validate that we actually got content
        if (!data.choices || !data.choices[0] || !data.choices[0].message.content) {
          throw new Error(`Model ${model} returned empty format`);
        }

        // If successful, return immediately and stop the loop
        return new Response(JSON.stringify(data), { status: 200 });

      } catch (error) {
        console.warn(`Fallback: ${model} failed. Reason: ${error.message}`);
        lastError = error;
        // The loop continues to the next model...
      }
    }

    // If the loop finishes and nothing worked:
    throw new Error(`All models failed. Last error: ${lastError?.message}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};