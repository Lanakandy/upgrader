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
    // 1. Parse body ONCE. 
    const { text, mode, customPrompt, task, level = 1, contextMode = 'speaking' } = await req.json();
    
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
      
      // Use contextMode to ensure the definition fits the register
      userMessage = `Define "${text}". Definition should be appropriate for a ${contextMode} context.`; 
    } 
    // -------------------------------------------------------------
    // 2. REWRITE/UPGRADE MODE
    // -------------------------------------------------------------
    else {
      systemPrompt = `You are an expert Applied Linguist specializing in Second Language Acquisition and language teaching.

MISSION: Rewrite the user's text to sound idiomatic, natural, and stylistically precise.
RULES:
1. Preserve core factual meaning.
2. Change structure/phrasing to match native proficiency (C1/C2 grammar and vocabulary).
3. EXPLANATION STYLE: Focus on specific linguistic improvements. Do NOT refer to "native speakers." Use "natural," "standard," or "proficient" instead.
4. OUTPUT FORMAT: valid, raw JSON only. No markdown.
{
  "text": "transformed sentence",
  "reason": "concise linguistic explanation (max 15 words). Focus on flow/tone."
}`;

      // -----------------------------------------------------------
      // SOPHISTICATION INSTRUCTIONS
      // -----------------------------------------------------------
      
      const PROMPT_TREE = {
        1: `TARGET: LEVEL 1 — PROFICIENCY & VARIATION
        Goal: Rewrite the input to reflect C1/C2-level English.
        Core Instruction:
        - If simple/intermediate: Upgrade grammar and vocabulary to a native standard.
        - If ALREADY advanced: You MUST provide a distinct, high-quality alternative phrasing. Do not return the same sentence. Change the specific vocabulary or sentence structure while keeping the same meaning.
        Focus:
        - Advanced, idiomatic vocabulary.
        - Natural contractions and reductions.
        - Lateral improvements: If the input is "famished", try "starving" or "running on fumes".`,

        2: `TARGET: LEVEL 2 — SPOKEN EXPRESSIVE (Expansion)
        Goal: Evolve the sentence by adding nuance, attitude, color, or situational detail. 
        Core Instruction:
        - Restructure and slightly expand the sentence to add emotion or context.
        - Build directly on the original meaning—do not invent unrelated backstory.
        - Use spoken rhythm (pauses, emphasis) and "flavor" words.
        Focus:
        - Expressiveness: Use hyperbole or vivid imagery where appropriate.
        - Grounding: Add specific details that make the speaker sound present in the moment.
        - Conversational Flow: Use discourse markers naturally.`
      };

      // -----------------------------------------------------------
      // CUSTOM PERSONA DEFINITIONS
      // -----------------------------------------------------------
      const CUSTOM_PERSONAS = {
        "Diplomat": `TARGET: THE DIPLOMAT (The Politician)
        Style: Sophisticated, evasive, and excessively polite.
        Linguistic Focus: 
        - Swap "I" for "we" to dilute responsibility.
        - Use passive voice to deflect direct need or blame.
        - Master "hedging" (use words like 'perhaps', 'it would appear', 'potentially').
        - Never state a direct need; frame it as a "collective priority" or "circumstantial requirement."`,

        "Disruptor": `TARGET: THE DISRUPTOR (Silicon Valley Tech)
        Style: High-energy, corporate-obsessed, abstract.
        Linguistic Focus:
        - Treat human feelings as "bandwidth issues" or "data points."
        - Use "actionable" verbs and corporate buzzwords (pivot, scale, leverage).
        - Frame simple tasks as "mission-critical objectives".
        - Sound visionary and urgent, even about mundane things.`,

        "IT Guy": `TARGET: THE STRAIGHT SHOOTER (No-Nonsense)
        Style: Blunt, dry, efficient.
        Linguistic Focus:
        - Strip away ALL "fluff", adjectives, and politeness markers.
        - Use short, chopped, declarative sentences.
        - Subject-Verb-Object only. 
        - Remove emotion. Just facts.`,

        "Counselor": `TARGET: THE COUNSELOR (Legal/Contractual)
        Style: Detached, cold, clinical, and airtight.
        Linguistic Focus:
        - DO NOT be emotional. Remove hyperbole (no "starving", no "love").
        - Use "The Subject" or "The Undersigned" instead of "I".
        - Use formal, Latinate vocabulary.
        - Draft the sentence as if it is a clause in a binding contract or affidavit.`,

        "Trendsetter": `TARGET: THE TRENDSETTER (Social Media/Gen Z)
        Style: Hyper-online, relatable, expressive.
        Linguistic Focus:
        - Use "voicey" punctuation (lowercase for aesthetic, or ALL CAPS for yelling).
        - Use internet slang (no cap, aesthetic, mood, vibe).
        - Focus on "relatability" and "engagement" over grammar.`
      };

      let specificInstruction = "";

      const targetPrompt = PROMPT_TREE[level] || PROMPT_TREE[1];

      if (mode === 'simplify') {
        specificInstruction = `TARGET: SIMPLIFY (The "Straight Talker")
        Goal: Strip the sentence back to how a proficient speaker would put it simply. Make it clearer and shorter.
        Context: Casual, direct speech.`;
        
      } else if (mode === 'custom') {
        const persona = CUSTOM_PERSONAS[customPrompt];
        
        if (persona) {
            specificInstruction = `STRICT MODE: IGNORE standard naturalness rules.
            ${persona}
            Make the transformation distinct and exaggerated to match this persona.`;
        } else {
            specificInstruction = `TARGET: CUSTOM
            Instruction: ${customPrompt || "Rewrite appropriately."}`;
        }

      } else {
        specificInstruction = targetPrompt;
      }

      // -----------------------------------------------------------
      // ASSEMBLE PROMPT
      // -----------------------------------------------------------
      userMessage = `INPUT TEXT: "${text}"

${specificInstruction}

CRITICAL: Return ONLY JSON.
ALWAYS provide a rewritten version, even if the input is already good. Find a better or alternative way to say it.`;
    } 

    // --- WATERFALL EXECUTION ---
    let lastError = null;
    
    for (const model of MODEL_CASCADE) {
      try {
        const controller = new AbortController();
        // 15 seconds timeout
        const timeoutId = setTimeout(() => controller.abort(), 15000); 

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://gridskai.com", 
            "X-Title": "Gridskai"
          },
          signal: controller.signal,
          body: JSON.stringify({
            "model": model,
            "messages": [
              { "role": "system", "content": systemPrompt },
              { "role": "user", "content": userMessage }
            ],
            "temperature": 0.7, 
            "response_format": { "type": "json_object" } 
          })
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Status ${response.status}`);
        
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content;
        
        if (!content) throw new Error("Empty response");

        // Clean Markdown and Thoughts
        content = content.replace(/```json/g, '').replace(/```/g, ''); 
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '');

        // Extract JSON block
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            content = content.substring(firstBrace, lastBrace + 1);
        }

        try {
            JSON.parse(content);
        } catch (e) {
            console.log(`Model ${model} returned invalid JSON: ${content}`);
            throw new Error("Invalid JSON received");
        }

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
    
    return new Response(JSON.stringify({ 
        error: "All models failed", 
        details: lastError?.message 
    }), { status: 502 });

  } catch (error) {
    console.error("Critical Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};