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
2. Change structure/phrasing to match native proficiency (C1/C2 grammar and vocabulary) and natural patterns (Collocations/Idioms).
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
        speaking: {
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
        },

        writing: {
          1: `TARGET: LEVEL 1 — PROFICIENCY & VARIATION
          Goal: Rewrite the input to reflect C1/C2-level English.
          Core Instruction:
          - If simple/intermediate: Upgrade grammar and vocabulary.
          - If ALREADY advanced: You MUST provide a stylistic alternative. Change the syntax or lexical choice to offer a different "flavor" of high-level writing.
          Focus:
          - Precise vocabulary and written collocations.
          - Improve sentence structure.
          - Fix literal translations.`,

          2: `TARGET: LEVEL 2 — EXPRESSIVE WRITTEN ENGLISH (Expansion)
          Goal: Expand the sentence slightly to add nuance, emphasis, or clarifying detail.
          Core Instruction:
          - Use measured structural elaboration (modifiers, subordinate clauses, appositives).
          - Introduce implication or depth that a skilled writer would include.
          - Keep additions relevant and proportional (don't over-write).
          Focus:
          - Sophisticated syntax (using subordination to show relationships between ideas).
          - Precision: Replace general verbs with specific, evocative ones.
          - Polished tone.`
        }
      };

      // -----------------------------------------------------------
      // MODE SELECTION
      // -----------------------------------------------------------
      const CUSTOM_PERSONAS = {
        "The Diplomat": `TARGET: THE DIPLOMAT (The Politician)
        Style: Sophisticated, evasive, and incredibly smooth.
        Linguistic Focus: 
        - Swap "I" for "we".
        - Use passive voice to deflect direct blame.
        - Master the art of "hedging" (use words like 'perhaps', 'potentially', 'under certain circumstances').
        - Never say a direct "no"; dilute the negative.`,

        "The Disruptor": `TARGET: THE DISRUPTOR (Silicon Valley Entrepreneur)
        Style: High-energy, forward-thinking, saturated with tech-speak.
        Linguistic Focus:
        - Use "actionable" verbs and corporate buzzwords.
        - Frame simple tasks as "mission-critical objectives".
        - Frame mistakes as "pivoting opportunities".
        - Sound visionary and urgent.`,

        "The Straight Shooter": `TARGET: THE STRAIGHT SHOOTER (No-Nonsense)
        Style: Blunt, efficient, radically honest.
        Linguistic Focus:
        - Strip away all "fluff", politeness markers, and hesitation.
        - Prioritize the most important info first (TL;DR style).
        - Use short, declarative sentences.`,

        "The Counselor": `TARGET: THE COUNSELOR (The Legal Eagle)
        Style: Precise, objective, airtight.
        Linguistic Focus:
        - Use formal vocabulary and technical precision.
        - Use "if/then" conditional structures to define scope.
        - Replace casual adjectives with specific terms to ensure zero ambiguity.`,

        "The Trendsetter": `TARGET: THE TRENDSETTER (Social Media Vlogger)
        Style: Relatable, expressive, hyper-modern.
        Linguistic Focus:
        - Use "voicey" punctuation (exclamation points, capitalization for emphasis).
        - Use contemporary slang and community-building phrases ("Let's dive in", "Hot take").
        - Prioritize emotional connection over formal grammar.`
      };

      let specificInstruction = "";

      const targetContext = PROMPT_TREE[contextMode] || PROMPT_TREE['speaking'];
      const targetPrompt = targetContext[level] || targetContext[1];

      if (mode === 'simplify') {
        specificInstruction = `TARGET: SIMPLIFY (The "Straight Talker")
        Goal: Strip the sentence back to how a proficient speaker would put it simply. Make it clearer and shorter.
        Context: ${contextMode === 'writing' ? 'Plain English for reading' : 'Casual, direct speech'}.`;
        
      } else if (mode === 'custom') {
        // CHECK IF THE PROMPT MATCHES A PRESET, OTHERWISE USE RAW TEXT
        const persona = CUSTOM_PERSONAS[customPrompt];
        
        if (persona) {
            specificInstruction = persona;
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
      // UPDATED: Removed the instruction to "return unchanged if perfect"
      userMessage = `INPUT TEXT: "${text}"

${specificInstruction}

CRITICAL: Return ONLY JSON.
ALWAYS provide a rewritten version, even if the input is already good. Find a better or alternative way to say it.`;
    } // <--- THIS BRACE WAS MISSING. IT CLOSES THE ELSE BLOCK.

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