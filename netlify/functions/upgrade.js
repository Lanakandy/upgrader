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
    const { text, mode, customPrompt, task, level = 2, contextMode = 'speaking' } = await req.json();
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
      const contextMode = req.json().contextMode || 'speaking'; 

      const PROMPT_TREE = {
        speaking: {
        1: `TARGET: LEVEL 1 — GRAMMAR AND VOCABULARY UPGRADE ("Natural Flow") 
        Goal: Upgrade BOTH vocabulary AND structure to C1/C2 levels. Make it sound like something a native English speaker
would naturally say.
        Focus:
        - C1/C2 grammar and vocabulary.
        - Use native collocations and fixed expressions.
        - Use natural contractions and reductions.
        - Fix literal translations.`,

        2: `TARGET: LEVEL 2 — SPOKEN EXPRESSIVE (The "Storyteller")
        Goal: Expand the sentence using vivid, emotional, casual spoken English.
        Focus:
        - Use native hyperbole ("starving", "wreck", "I could eat a horse").
        - Add texture through specific, grounded details.
        - Use dramatic sentence rhythm and word choice.
        - Avoid literary/novelistic prose; keep it conversational.`,

        3: `TARGET: LEVEL 3 — PROFESSIONAL POLISH (The "Executive")
        Goal: Elevate to a refined, cultivated, and prestigious register.
        Focus:
        - Use "educated" vocabulary that signals high status, but remains clear.
        - Formal, precise, sophisticated vocabulary.
        - Diplomatic hedging ("I think" -> "It would appear that").
        - Tone: Confident, understated authority. Not pompous, just highly literate.`,
      },
        writing: {
          1: `TARGET: LEVEL 1 — GRAMMAR AND VOCABULARY UPGRADE ("Natural Flow") 
        Goal: Upgrade BOTH vocabulary AND structure to C1/C2 levels. GRAMMAR AND VOCABULARY UPGRADE ("Natural Flow") 
        Make it sound like something a native English speaker would naturally write.
              Focus:
              - C1/C2 grammar and vocabulary.
              - Use native written collocations and fixed expressions.
              - Use standard written forms (less reliance on phrasal verbs).`,

          2: `TARGET: LEVEL 2 — EXPRESSIVE WRITTEN ENGLISH ("Engaging Prose")
              Goal: Expand the sentence, use interesting, varied writing structure.
              Focus:
              - Concrete, grounded detail over vague abstraction.
              - Vary sentence length to avoid monotony.
              - Use strong active verbs.
              - Better transitions between ideas.`,

          3: `TARGET: LEVEL 3 — PROFESSIONAL POLISH (Written)
              Goal: Elevate to a formal, professional, cultivated written register.
              Focus:
              - Sophisticated, "educated" vocabulary.
              - Nominalization where appropriate for gravity.
              - Diplomatic and nuanced phrasing.
              - Subordinate clauses to add nuance and qualification.
              - No contractions.`,
        }
      };
      // -----------------------------------------------------------
      // MODE SELECTION
      // -----------------------------------------------------------
      let specificInstruction = "";

      const targetContext = PROMPT_TREE[contextMode] || PROMPT_TREE['speaking'];
      const targetPrompt = targetContext[level] || targetContext[2];

      if (mode === 'simplify') {
        specificInstruction = `TARGET: SIMPLIFY (The "Straight Talker")
        Goal: Strip the sentence back to how a native speaker would put it. Make it clearer and shorter.
        Context: ${contextMode === 'writing' ? 'Plain English for reading' : 'Casual, direct speech'}.`;
      } else if (mode === 'custom') {
        specificInstruction = `TARGET: CUSTOM
        Instruction: ${customPrompt || "Rewrite appropriately."}`;
      } else {
        specificInstruction = targetPrompt;
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