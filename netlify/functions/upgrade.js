export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) return new Response(JSON.stringify({ error: "Server API Key missing" }), { status: 500 });

  // DeepSeek R1 and Trinity are great, but ensure fallback to 4o-mini for speed/reliability
  const MODEL_CASCADE = [
    "arcee-ai/trinity-large-preview:free", 
    "openai/gpt-4o-mini", 
    "tngtech/deepseek-r1t2-chimera:free",
  ];

  try {
    const { text, mode, customPrompt, task, level = 2 } = await req.json();

    let systemPrompt = "";
    let userMessage = "";

    // -------------------------------------------------------------
    // 1. DEFINITION MODE
    // -------------------------------------------------------------
    if (task === 'define') {
      systemPrompt = `You are an expert Etymologist. 
      Output ONLY valid JSON with keys: 
      - "definition" (string)
      - "transcription" (string, IPA format)
      - "nuance" (string)
      No markdown formatting.`;
      
      userMessage = `Define "${text}" considering this context: "${context}".`;
    } 
    // -------------------------------------------------------------
    // 2. REWRITE/UPGRADE MODE
    // -------------------------------------------------------------
    else {
      // Base Persona & Output Rules
      systemPrompt = `You are an expert Applied Linguist specializing in Second Language Acquisition.

MISSION: Rewrite the user's text to sound idiomatic, natural, and stylistically precise.
RULES:
1. Preserve core factual meaning.
2. NO synonyms swaps. Change structure/phrasing to match natural patterns.
3. EXPLANATION STYLE: Focus on specific linguistic improvements (e.g. "more direct," "reduces redundancy," "improves flow"). Do NOT refer to "native speakers." Use "natural" or "standard" instead.
4. OUTPUT FORMAT: valid, raw JSON only. No markdown (no \`\`\`json).
{
  "text": "transformed sentence",
  "reason": "concise linguistic explanation (max 15 words). Focus on flow/tone. Do NOT use the word 'native'."
}`;


      // -----------------------------------------------------------
      // SOPHISTICATION INSTRUCTIONS
      // -----------------------------------------------------------
      const sophisticatePrompts = {
        1: `TARGET: LEVEL 1 — GRAMMAR AND VOCABULARY UPGRADE ("Natural Flow") 
        Goal: Upgrade BOTH vocabulary AND structure to C1/C2 levels. Make it sound natural and idiomatic.
        Focus:
        - C1/C2 grammar and vocabulary.
        - Use native collocations and fixed expressions
        - Use natural contractions and reductions.
        - Fix literal translations.`,

        2: `TARGET: LEVEL 2 — SPOKEN EXPRESSIVE (The "Storyteller")
        Goal: Vivid, emotional, casual spoken English.
        Focus:
        - Use native hyperbole ("starving", "wreck").
        - Ground emotions in physical details.
        - Use dramatic sentence rhythm and word choice.
        - Avoid literary/novelistic prose; keep it conversational.`,

        3: `TARGET: LEVEL 3 — PROFESSIONAL POLISH (The "Executive")
        Goal: Elevate to a refined, cultivated, and prestigious register.
        Focus:
        - Use "educated" vocabulary that signals high status, but remains clear.
        - Formal, precise, sophisticated vocabulary.
        - Diplomatic hedging ("I think" -> "It would appear that").
        - Tone: Confident, understated authority. Not pompous, just highly literate.`,
      };

      // -----------------------------------------------------------
      // MODE SELECTION
      // -----------------------------------------------------------
      let specificInstruction = "";

      if (mode === 'simplify') {
        specificInstruction = `TARGET: SIMPLIFY (The "Straight Talker")
        Goal: Strip the sentence back to how a native speaker would say this casually. Make it punchy, direct, and casual.
        Focus:
        - Anglo-Saxon roots over Latinate.
        - Choose concrete words over abstract ones.
        - Use phrasal verbs.
        - Remove redundancy.`;
      } else if (mode === 'custom') {
        specificInstruction = `TARGET: CUSTOM
        Instruction: ${customPrompt || "Rewrite natively."}`;
      } else {
        // Default to sophisticate
        specificInstruction = sophisticatePrompts[level] || sophisticatePrompts[2];
      }

      // -----------------------------------------------------------
      // ASSEMBLE PROMPT
      // -----------------------------------------------------------
      userMessage = `INPUT TEXT: "${text}"

${specificInstruction}

CRITICAL: Return ONLY JSON.
If the input is already perfect, return it unchanged but explain why in 'reason'.`;
    }

    // --- WATERFALL EXECUTION ---
    let lastError = null;
    
    for (const model of MODEL_CASCADE) {
      try {
        const controller = new AbortController();
        // Increased timeout slightly to 5000ms to allow "Thinking" models (DeepSeek) to process
        const timeoutId = setTimeout(() => controller.abort(), 5000); 

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://gridskai.com", // OpenRouter requires these for rankings
            "X-Title": "Gridskai"
          },
          signal: controller.signal,
          body: JSON.stringify({
            "model": model,
            "messages": [
              { "role": "system", "content": systemPrompt },
              { "role": "user", "content": userMessage }
            ],
            // Temperature 0.7 is usually better for JSON structure than 0.85
            "temperature": 0.7, 
            "response_format": { "type": "json_object" } 
          })
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Status ${response.status}`);
        
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content;
        
        if (!content) throw new Error("Empty response");

        // CLEANUP: Some models return markdown blocks (```json ... ```) despite instructions.
        // We strip them to ensure valid JSON parsing on the frontend.
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        // Validating JSON before returning to ensure frontend doesn't crash
        try {
            JSON.parse(content);
        } catch (e) {
            throw new Error("Invalid JSON received from model");
        }

        // Return the raw OpenRouter format, but with cleaned content if needed, 
        // or just construct a simplified response object for your frontend.
        // Here we return the full structure to maintain compatibility with your current frontend.
        data.choices[0].message.content = content;
        
        return new Response(JSON.stringify(data), { status: 200 });

      } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`Skipping ${model} due to timeout`);
        } else {
            console.log(`Skipping ${model} due to error: ${error.message}`);
        }
        lastError = error;
      }
    }
    
    // If all models fail
    return new Response(JSON.stringify({ 
        error: "All models failed", 
        details: lastError?.message 
    }), { status: 500 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};