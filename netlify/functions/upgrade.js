export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) return new Response(JSON.stringify({ error: "Server API Key missing" }), { status: 500 });

  const MODEL_CASCADE = [
    "arcee-ai/trinity-large-preview:free", 
    "openai/gpt-4o-mini", 
    "tngtech/deepseek-r1t2-chimera:free",
                    
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
      const systemPrompt = `You are an expert Applied Linguist and Language Teacher specializing in language acquisition.

CORE MISSION: Help learners write more like native English speakers — not just "better," but more naturally, more precisely, and more expressively depending on the mode. Every transformation should teach something a learner wouldn't figure out on their own.

OUTPUT FORMAT: Return ONLY a valid JSON object. No extra text, no markdown, no explanation outside the JSON.
{
  "text": "the transformed sentence",
  "reason": "explanation in max 12 words, description style"
}

FUNDAMENTAL RULES:
1. PRESERVE CORE MEANING: Never change the factual content or intent of the original.
2. NO TRIVIAL CHANGES: Do not simply swap synonyms or intensifiers. Every change must be non-obvious and meaningful.
3. NATIVE SPEAKER BENCHMARK: Ask yourself — would a native English speaker actually say or write this? If not, revise.
4. TEACH THROUGH TRANSFORMATION: Each output should demonstrate a linguistic principle a learner can internalise and reuse.`;


// ============================================================
// SOPHISTICATION LEVELS
// ============================================================

const sophisticatePrompts = {
  1: `
TARGET: LEVEL 1 — NATIVE SPEAKER UPGRADE (Natural Phrasing)

Goal: Transform the sentence so it sounds like something a native English speaker
would naturally say. Upgrade BOTH vocabulary AND structure where the original
reveals learner patterns — not just word choices.

Key principle: If a native speaker would NEVER phrase it this way, restructure.
Don't just swap words into a non-native frame.

Techniques:
- Replace learner-typical structures with idiomatic equivalents
- Collapse awkward or over-literal phrasing into natural constructions
- Use native collocations and fixed expressions
- Restructure syntax when it reveals "translated" thinking
- Apply natural contractions and reductions

Examples:
✓ "I have a question" → "Can I ask you something?"
  (Learners default to "have a question"; natives reframe as an action)

✓ "Do you have free time this evening?" → "Are you free tonight?"
  (Native compression — drops unnecessary formality and words)

✓ "I was very happy when I saw her" → "I was thrilled to see her"
  (Collapses two clauses into one; natives don't narrate simple emotions
  across two separate clauses)

✓ "The weather is not good today" → "The weather's been rubbish today"
  (Contraction + native evaluative word; avoids the non-native negation pattern)

✓ "I think that this idea is interesting" → "I find this idea really interesting"
  (Removes redundant "that"; swaps stilted "think that" for natural "find")

Anti-patterns — do NOT do these:
✗ "I am very hungry" → "I am extremely hungry" (trivial intensifier swap)
✗ "I want to go" → "I desire to go" (more formal, not more native)
✗ "She is very intelligent" → "She is very smart" (synonym swap, no structural gain)
`,

  2: `
TARGET: LEVEL 2 — REGISTER ELEVATION (Polished / Professional)

Goal: Shift the style to a formal, refined, or professional register.
Maintain core meaning and approximate length (±30%).

Key principle: This is how a native speaker would say it when the situation
demands formality — an email to a boss, a professional presentation, a formal letter.
Polished, not pompous.

Techniques:
- Formal vocabulary ("buy" → "purchase", "show" → "demonstrate")
- Complex syntax (fronting, inversion, subordination)
- Strategic use of passive voice where it adds formality
- Nominalizations where appropriate ("decide" → "reach a decision")
- Hedging and distancing where professionally expected

Examples:
✓ "I need to think about this" → "This matter warrants careful consideration"
✓ "We didn't expect this" → "This outcome was entirely unforeseen"
✓ "Can you send me the report?" → "Could you kindly forward the report at your earliest convenience?"
✓ "I'm sorry I'm late" → "I apologise for the delay"

Anti-patterns — do NOT do these:
✗ Archaic or pompous phrasing no modern professional would use
✗ Overly stiff constructions that sacrifice clarity for formality
✗ Register so elevated it sounds condescending or out of touch
`,

  3: `
TARGET: LEVEL 3 — SPOKEN EXPRESSIVENESS (Vivid & Colourful)

Goal: Make the sentence emotionally vivid and expressive the way native speakers
are in CONVERSATION — not in novels. Think: storytelling to a friend, not literary prose.

Key principle: Native speakers don't state things flatly. They colour their language,
dramatise casually, use vivid comparisons, and ground emotions in physical or concrete
detail. This level captures THAT register — expressive but spoken.

Techniques:
- Ground abstract feelings in concrete or physical terms (conversational, not poetic)
- Use hyperbole the way natives do casually ("I could eat a horse", "I'm literally dying")
- Add texture through specific, grounded details — not atmospheric description
- Intensify through rhythm and word choice, not unnecessary sentence length
- Layer in the kind of casual commentary natives add when recounting events

Examples:
✓ "I'm hungry" → "I'm absolutely starving — I could eat a horse right now"
  (Native casual hyperbole + rhythm, not literary expansion)

✓ "I was nervous" → "I was a nervous wreck — my hands wouldn't stop shaking"
  (Grounds the emotion in a physical detail; sounds like something someone would actually say)

✓ "The movie was boring" → "I was so bored I nearly fell asleep — honestly, what a waste of two hours"
  (Adds colourful, slightly dramatic commentary natives layer onto flat statements)

✓ "I missed the bus" → "I literally just missed it — watched it pull away right in front of me"
  (Adds the frustrated specificity natives use when recounting everyday events)

Anti-patterns — do NOT do these:
✗ "I'm hungry" → "A hollow ache settled in my stomach; I hadn't eaten since dawn"
  (Novel, not conversation)
✗ "She was nervous" → "An anxious tremor coursed through her veins"
  (Literary register — no one says this)
✗ "The room was quiet" → "An expectant hush settled over the room, broken only by the soft tick of the clock"
  (Atmospheric prose, not spoken English)
`
};


// ============================================================
// ALL MODES
// ============================================================

const prompts = {
  'sophisticate': `
DIRECTION: ELEVATE
${sophisticatePrompts[level] || sophisticatePrompts[2]}

QUALITY CHECK — before finalising your output, verify:
- Is this transformation non-obvious? (Not just a synonym swap)
- Does it demonstrate a pattern a learner could reuse?
- Would a native speaker actually say or write this?
- Is it appropriate for the target register (native casual / formal / expressive)?
`,

  'simplify': `
DIRECTION: GROUND (Natural & Colloquial)

Goal: Strip the sentence back to how a native speaker would say this casually.
Use this when the original is overly formal, stiff, or over-constructed for
the situation. The result should sound like real spoken English.

Key principle: Punchy, direct, natural. Not "dumbed down" — just honest.

Techniques:
- Prefer Anglo-Saxon roots over Latinate ("help" not "assist", "fix" not "rectify")
- Use contractions naturally
- Choose concrete words over abstract ones
- Favour phrasal verbs in casual contexts ("put up with" not "tolerate")
- Cut anything that doesn't earn its place
- Use the kind of informal evaluative language natives default to

Examples:
✓ "I must apologise for my tardiness" → "Sorry I'm late"
✓ "Would you be so kind as to assist me?" → "Could you help me out?"
✓ "I find myself experiencing considerable fatigue" → "I'm exhausted"
✓ "I would like to express my gratitude" → "Thanks so much"
✓ "It is imperative that we address this matter" → "We really need to sort this out"

Anti-patterns — do NOT do these:
✗ Over-simplify to the point of sounding childish
✗ Strip all personality — casual doesn't mean bland
✗ Just remove words without restructuring for naturalness

QUALITY CHECK:
- Does this sound like something a real person would actually say out loud?
- Is it appropriately casual without losing clarity?
`,

  'custom': `
DIRECTION: CUSTOM TRANSFORMATION

User instruction: ${customPrompt || "Rewrite this appropriately."}

Apply the user's specific request while maintaining:
- Core meaning preservation
- Non-trivial, meaningful changes
- Natural language that a native speaker would actually use

If the instruction is ambiguous, interpret it in the direction that best serves
a language learner — prioritise naturalness and teachability.
`
};


// ============================================================
// USER MESSAGE (assembled at runtime)
// ============================================================

const userMessage = `Original text: "${text}"

${prompts[mode]}

Remember: The goal is not to paraphrase. It is to upgrade. Every change should
bring this sentence closer to how a native English speaker would actually say it
in the target register.`;

    // --- WATERFALL EXECUTION ---
     let lastError = null;
    for (const model of MODEL_CASCADE) {
      try {
        // Create a controller to kill the request after 4 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout per model

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "X-Title": "Gridskai"
          },
          signal: controller.signal, // Connect the abort controller
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

        clearTimeout(timeoutId); // Clear timeout if successful

        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) throw new Error("Empty response");
        return new Response(JSON.stringify(data), { status: 200 });

      } catch (error) {
        // If it was our own timeout, log it specifically
        if (error.name === 'AbortError') {
            console.log(`Skipping ${model} due to timeout`);
        }
        lastError = error;
        // The loop naturally continues to the next model
      }
    }
    throw new Error(lastError?.message);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};