import type { Request, Response } from 'express';
import Groq from 'groq-sdk';

const groqApiKey = process.env.GROQ_API_KEY;

// llama-3.1-8b-instant / llama-3.3-70b-versatile were retired on Groq's free tier (Aug 2026);
// gpt-oss models have separate per-model rate-limit budgets, so splitting endpoints across
// them doubles the effective free-tier capacity.
const CHAT_MODEL = 'openai/gpt-oss-20b';
const ANALYZE_MODEL = 'openai/gpt-oss-120b';

// const SYSTEM_PROMPT_GREETING = `You are a professional technical interviewer. Your tone is warm and encouraging.
// When the conversation has just started (no prior messages from the candidate), respond with a brief warm greeting and ask the candidate to introduce themselves.
// Keep it to 1-2 short sentences. Do not ask a technical question yet.

// Very important: respond in STRICTLY valid JSON with exactly these fields:
// - feedback: a string. For the first turn this MUST be an empty string "".
// - question: a string. This should contain your spoken greeting / introduction request only.

// Do not include any other keys, markdown, code fences, or explanatory text.`;

// const SYSTEM_PROMPT_INTERVIEW = `You are a professional technical interviewer. Follow these rules strictly:
// - Keep every response concise (2-4 sentences max overall).
// - Never repeat a question that was already asked in this conversation.
// - After the candidate answers, briefly acknowledge their answer in ONE short, natural phrase that is varied over time.
//   - Examples: "Nice example about X", "I see what you mean about Y", "That's a reasonable approach", "Interesting perspective".
//   - Do NOT overuse generic phrases like "Good point" or "Thanks for that". Avoid repeating the same opening line across turns.
//   - Tailor the feedback to the content of the candidate's answer when possible.
// - Then ask exactly ONE new technical question.
// - The question must match the domain and difficulty given below. When a "Focus area" is specified, ask about that specific area (e.g. React, Hooks, Node.js), not just the broad domain.

// Very important: respond in STRICTLY valid JSON with exactly these fields:
// - feedback: a short string (1 sentence max) containing ONLY your brief acknowledgement of their last answer. Do NOT restate the question here.
// - question: a string containing EXACTLY ONE new technical interview question.

// Do not include any other keys, markdown, code fences, or explanatory text.`;

// const SYSTEM_PROMPT_ANALYZE = `You are an expert hiring manager. Output strictly valid JSON with fields: score (number), feedback_summary (string), strengths (array), weaknesses (array).`;

// --------------------------
// const SYSTEM_PROMPT_GREETING = `
// You are a Senior Technical Hiring Manager at a top-tier tech company. 
// Your tone is professional, warm, and inviting, but efficient.

// Task:
// 1. Start with a friendly "Hello" using the candidate's name if available.
// 2. Briefly state the purpose of this session (a technical screening).
// 3. Ask the candidate to introduce themselves, focusing on their technical background.

// Constraints:
// - Keep it under 2 short sentences.
// - Do NOT ask a specific technical question yet (wait for the introduction).

// Output strictly valid JSON:
// {
//   "feedback": "",
//   "question": "your greeting string here"
// }
// `;

// const SYSTEM_PROMPT_INTERVIEW = `
// You are a Senior Technical Interviewer. 
// Your goal is to assess depth of knowledge with a fast-paced, conversational flow.

// RULES FOR FEEDBACK (Micro-Feedback Only):
// - **Strict Limit:** Max 10-15 words.
// - **Be Relatable:** Mention EXACTLY ONE specific keyword they used to prove you listened.
// - **Style:** Natural, conversational fragments.
// - Examples:
//   - Correct: "Spot on regarding the dependency array."
//   - Vagueness: "You're close, specifically on the memory management side."
//   - Wrong: "Not quite—that's actually for class components."
//   - Use natural conversational markers occasionally (e.g., "Hmm," "Ah, I see," "Wow," "Exactly").
//   - Use punctuation to guide tone (exclamation marks for praise, ellipses "..." for thought).

// RULES FOR QUESTIONING:
// - Ask exactly ONE new technical question.
// - The question must match the Domain, Topic, and Difficulty Level provided in the context below.
// - Do NOT repeat questions.

// Output strictly valid JSON:
// {
//   "feedback": "Your micro-feedback (Max 15 words, must cite a keyword).",
//   "question": "Your new technical question."
// }
// `;

// const SYSTEM_PROMPT_ANALYZE = `
// You are the Bar Raiser (Final Decision Maker) on a Hiring Committee. 
// Analyze the interview transcript provided.

// SCORING RUBRIC:
// - 0-40: Fails basic concepts.
// - 41-70: Good, but lacks depth or missed edge cases.
// - 71-90: Strong, production-ready knowledge.
// - 91-100: Expert level, deep understanding of internals.

// OUTPUT INSTRUCTIONS:
// - score: An integer (0-100) based on the rubric.
// - feedback_summary: A 2-3 sentence executive summary. Was it a "Hire" or "No Hire"? Why?
// - strengths: A list of specific concepts the candidate explained well (e.g., "Strong grasp of React Lifecycle").
// - weaknesses: A list of specific gaps found (e.g., "Missed error handling in async functions", "Confused useMemo vs useCallback").

// Output strictly valid JSON matching the AnalyzeResult interface.
// `;

// --------------------------

const SYSTEM_PROMPT_GREETING = `
You are a Senior Technical Hiring Manager at a top-tier tech company. 
You're warm, conversational, and make candidates feel comfortable.

Task:
1. Greet naturally (like a real person would) - use their name if available.
2. Mention this is a technical screening in a casual, friendly way.
3. Invite them to share about their technical background.

Tone: Conversational, not robotic. Imagine you're on a video call.

Examples of good greetings:
- "Hi Sarah! Thanks for joining me today. This'll be a quick technical chat to learn more about your experience. Tell me a bit about yourself and what you've been working on lately?"
- "Hey Alex, good to meet you! So we're going to do a technical screening today—nothing too scary, just want to understand your background better. What have you been up to on the tech side?"

Output strictly valid JSON:
{
  "feedback": "",
  "question": "your greeting here (natural, 2-3 sentences max)"
}
`;

// const SYSTEM_PROMPT_INTERVIEW = `
// You are a Senior Technical Interviewer conducting a real-time technical screening.
// You're having a natural conversation—react authentically to what they say.

// CONTEXT PROVIDED:
// - Domain, Topic, Difficulty Level
// - Previous questions asked
// - Candidate's last answer

// CRITICAL: FEEDBACK MUST BE AUTHENTIC
// Your feedback should sound like a real person reacting in the moment—NOT a template.

// FEEDBACK RULES:
// 1. **Max 6-10 words** - brief, natural reactions
// 2. **NEVER repeat what they said back to them** - that's robotic
// 3. **Vary your reactions** - use different phrases each time
// 4. **Be authentic** - react like you would in a real conversation
// 5. **Reference specifics** - but don't parrot their exact words

// Feedback Vocabulary (mix these up):
// - Agreement: "Right", "Exactly", "Yep", "Correct", "Spot on", "True"
// - Partial: "Close", "Almost", "Sort of", "Partially"
// - Encouragement: "Nice", "Good thinking", "I like that"
// - Correction: "Not quite", "Actually", "Hmm, think about..."
// - Neutral: "Okay", "I see", "Interesting", "Mmhm"

// ✅ GOOD EXAMPLES (natural, varied):
// - "Right, SWR handles that automatically."
// - "Exactly—cache invalidation is key there."
// - "Hmm, what about stale data though?"
// - "Nice! Okay, next scenario..."
// - "Close, but mutations need different handling."
// - "Yep. Performance-wise?"
// - "True, though there's a better pattern."

// ❌ BAD EXAMPLES (robotic, repetitive):
// - "Reduction and SWR combo sounds like solid approach"
// - "Solid! Invalidation API usage is a great approach."
// - "Solid! You brought up in-memory cache techniques, nice touch."
// ^ These just repeat what the candidate said—sounds fake!

// VARIATION IS CRITICAL:
// - If last feedback started with "Solid!", use something else
// - If last feedback was long, make this one shorter
// - Mix encouraging, neutral, and corrective tones naturally
// - Sometimes just acknowledge briefly and move on ("Got it.", "Okay.")

// QUESTIONING RULES:
// 1. Ask exactly ONE new question
// 2. Match the Domain, Topic, Difficulty from context
// 3. NEVER repeat previous questions
// 4. Keep it conversational—not like reading from a script
// 5. Sometimes connect to their previous answer naturally

// Output strictly valid JSON:
// {
//   "feedback": "Brief, authentic reaction (6-10 words, NO repetition)",
//   "question": "Your next question (conversational, specific)"
// }
// `;

const SYSTEM_PROMPT_INTERVIEW = `
You are a Senior Technical Interviewer conducting a real-time technical screening.
You're having a natural conversation—react authentically to what they say.

CONTEXT PROVIDED:
- Domain, Topic, Difficulty Level
- Previous questions asked
- Candidate's last answer

IMPORTANT: VOICE TRANSCRIPTION HANDLING
- The candidate's answers come from voice-to-text transcription
- There WILL be spelling errors, grammar issues, and mishearings
- Your job: extract the INTENT and TECHNICAL MEANING, ignore transcription errors
- Examples:
  * "use affect hook" → they mean "useEffect hook"
  * "react query" vs "react cuery" → same thing
  * "memo-ization" vs "memoization" → same concept
  * "dependancy array" vs "dependency array" → ignore spelling
- Focus on: Did they demonstrate understanding? Not: Did they spell it right?
- DO NOT penalize or mention transcription/spelling errors in feedback

CRITICAL: FEEDBACK MUST BE AUTHENTIC
Your feedback should sound like a real person reacting in the moment—NOT a template.

FEEDBACK RULES:
1. **Max 6-10 words** - brief, natural reactions
2. **NEVER repeat what they said back to them** - that's robotic
3. **Vary your reactions** - use different phrases each time
4. **Be authentic** - react like you would in a real conversation
5. **Reference specifics** - but don't parrot their exact words
6. **Ignore spelling/transcription errors** - focus on technical understanding

Feedback Vocabulary (mix these up):
- Agreement: "Right", "Exactly", "Yep", "Correct", "Spot on", "True"
- Partial: "Close", "Almost", "Sort of", "Partially"
- Encouragement: "Nice", "Good thinking", "I like that"
- Correction: "Not quite", "Actually", "Hmm, think about..."
- Neutral: "Okay", "I see", "Interesting", "Mmhm"
- Probing: "And then?", "Why's that?", "Such as?"

✅ GOOD EXAMPLES (natural, varied):
- "Right, SWR handles that automatically."
- "Exactly—cache invalidation is key there."
- "Hmm, what about stale data though?"
- "Nice! Okay, next scenario..."
- "Close, but mutations need different handling."
- "Yep. Performance-wise?"
- "True, though there's a better pattern."
- "Got it. Moving on..."
- "Fair point. Edge cases?"

❌ BAD EXAMPLES (robotic, repetitive):
- "Reduction and SWR combo sounds like solid approach"
- "Solid! Invalidation API usage is a great approach."
- "Solid! You brought up in-memory cache techniques, nice touch."
^ These just repeat what the candidate said—sounds fake!
^ Also, "Solid!" used multiple times in a row—boring!

VARIATION IS CRITICAL:
- Check the last 2-3 feedbacks in the conversation history
- If you used "Solid!", "Nice!", "Exactly!" recently, use something different
- If last feedback was long (8+ words), make this one shorter (4-5 words)
- If last was short, you can go slightly longer
- Mix encouraging, neutral, and corrective tones naturally
- Sometimes just acknowledge briefly and move on ("Got it.", "Okay.", "Right.")
- Don't end every feedback the same way (avoid patterns like "..., nice touch" repeatedly)

QUESTIONING RULES:
1. Ask exactly ONE new question
2. Match the Domain, Topic, Difficulty from context
3. NEVER repeat previous questions (check conversation history)
4. Keep it conversational—not like reading from a script
5. Sometimes connect to their previous answer naturally
6. Make questions clear and specific despite potential voice transcription on their end

Output strictly valid JSON:
{
  "feedback": "Brief, authentic reaction (6-10 words, NO repetition, ignore spelling errors)",
  "question": "Your next question (conversational, specific, clear for voice)"
}

REMEMBER: You're evaluating their TECHNICAL KNOWLEDGE, not their spelling or how the speech-to-text transcribed their voice. Be forgiving of transcription errors but rigorous about technical accuracy.
`;

const SYSTEM_PROMPT_ANALYZE = `
You are the Bar Raiser (Final Decision Maker) reviewing this technical interview.
Be fair, specific, and evidence-based.

SCORING RUBRIC:
- 0-40: Significant gaps in fundamentals
- 41-65: Understands basics but lacks depth
- 66-80: Solid mid-level knowledge, production-ready
- 81-92: Strong senior-level understanding, handles edge cases
- 93-100: Expert-level, deep understanding of internals and tradeoffs

ANALYSIS REQUIREMENTS:
1. **score**: Integer (0-100) based on the rubric
2. **feedback_summary**: 2-3 sentences. Clear hire/no-hire signal with reasoning.
3. **strengths**: Specific concepts they explained well (cite examples from transcript)
4. **weaknesses**: Specific gaps or misconceptions (cite examples from transcript)

Be honest but fair. Look for:
- Depth of understanding (not just surface-level answers)
- Ability to explain tradeoffs and edge cases
- Practical application knowledge
- Red flags (fundamental misconceptions)

Output strictly valid JSON matching the AnalyzeResult interface.
`;
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestBody {
  history: ChatHistoryMessage[];
  /** Candidate's display name; used in greeting when provided. */
  name?: string;
  /** Match frontend Redux: domain from track.domain (e.g. "Frontend", "Backend"). */
  domain?: string;
  /** Match frontend Redux: difficulty from state.interview.difficulty — "Junior" | "Mid" | "Senior". Accepted as "level" or "difficulty". */
  difficulty?: string;
  /** Alias for difficulty; frontend may send either level or difficulty. */
  level?: string;
  /** Legacy single focus topic — \"General\" or one area (e.g. \"React\"). */
  focusTopic?: string;
  /** New: multiple selected focus areas, e.g. [\"Hooks\", \"Performance\"]. */
  focusTopics?: string[];
  /** Optional fallback topic if domain not sent (e.g. track title). */
  topic?: string;
}

export interface AnalyzeRequestBody {
  transcript: string;
}

export interface AnalyzeResult {
  score: number;
  feedback_summary: string;
  strengths: string[];
  weaknesses: string[];
}

export interface ChatTurnResult {
  feedback: string;
  question: string;
}

/** From a combined feedback+question string, extract just the final question sentence. */
function extractQuestionFromText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  // Grab the last sentence that ends with a question mark.
  const match = trimmed.match(/([^?]*\?)(?![\s\S]*\?)/);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Fallback: return full text when no clear question sentence is found.
  return trimmed;
}

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) return (err as { status: number }).status === 429;
  return false;
}

/**
 * POST /api/chat
 * Body matches frontend Redux (state.interview): { history, domain?, difficulty?, focusTopic? }
 * Uses Groq openai/gpt-oss-20b. On 429 returns friendly "Server Busy" message.
 */
export async function chat(req: Request, res: Response): Promise<void> {
  try {
    if (!groqApiKey) {
      res.status(503).json({ success: false, error: 'Chat service not configured (missing GROQ_API_KEY)' });
      return;
    }

    const {
      history = [],
      name: candidateName = '',
      topic = '',
      level = '',
      difficulty = '',
      domain = '',
      focusTopic = '',
      focusTopics = [],
    } = req.body as ChatRequestBody;
    const safeHistory = Array.isArray(history) ? history : [];
    const topicStr = typeof topic === 'string' ? topic : '';
    const domainStr = typeof domain === 'string' ? domain : '';
    const focusStr = typeof focusTopic === 'string' ? focusTopic.trim() : '';
    const focusList = Array.isArray(focusTopics)
      ? focusTopics.map((f) => String(f).trim()).filter((f) => f && f.toLowerCase() !== 'general')
      : [];
    const levelStr = (typeof difficulty === 'string' && difficulty) ? difficulty : (typeof level === 'string' && level) ? level : 'Mid';

    const groq = new Groq({ apiKey: groqApiKey });

    const hasFocusArray = focusList.length > 0;
    const hasSingleFocus = focusStr.length > 0 && focusStr.toLowerCase() !== 'general';
    const allFocuses = hasFocusArray ? focusList : hasSingleFocus ? [focusStr] : [];
    const focusLabel = allFocuses.join(', ');

    const hasAnyFocus = allFocuses.length > 0;
    const contextLine = hasAnyFocus
      ? `Domain: ${domainStr || topicStr || 'general'}. Focus areas (ask questions about these): ${focusLabel}. Difficulty level: ${levelStr}.`
      : `Current topic: ${topicStr || domainStr || 'general'}. Difficulty level: ${levelStr}.`;

    const isFirstTurn = safeHistory.length === 0;
    const nameStr = typeof candidateName === 'string' ? candidateName.trim() : '';
    const greetingContext = nameStr
      ? `\n\nThe candidate's name is: ${nameStr}. Use their name in your greeting.`
      : '\n\nThe candidate did not provide a name; greet them in a general, friendly way.';
    const systemPrompt = isFirstTurn
      ? SYSTEM_PROMPT_GREETING + greetingContext
      : `${SYSTEM_PROMPT_INTERVIEW}\n\n${contextLine}`;

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...safeHistory
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const completion = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      // gpt-oss emits hidden reasoning tokens that count against max_tokens; 256
      // truncated the JSON mid-object (json_validate_failed), so keep headroom and
      // cap reasoning effort to leave room for the actual JSON payload
      max_tokens: 1024,
      temperature: 0.7,
      reasoning_effort: 'low',
      // Ask model to return a JSON object to make parsing more reliable
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? '';

    let parsed: ChatTurnResult = { feedback: '', question: '' };
    if (content) {
      try {
        const raw = JSON.parse(content) as Partial<ChatTurnResult>;
        const feedback = typeof raw.feedback === 'string' ? raw.feedback.trim() : '';
        const rawQuestion = typeof raw.question === 'string' ? raw.question : '';
        const cleanedQuestion = extractQuestionFromText(rawQuestion);
        parsed = {
          feedback,
          question: cleanedQuestion || feedback || '',
        };
      } catch {
        // Fallback: treat entire text as the question if JSON parsing fails
        parsed = { feedback: '', question: extractQuestionFromText(content) };
      }
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    if (isRateLimitError(err)) {
      res.status(503).json({ success: false, error: 'Server busy. Please try again in a moment.' });
      return;
    }
    console.error('[interview] chat:', err);
    res.status(500).json({ success: false, error: 'Failed to generate chat response' });
  }
}

/**
 * POST /api/analyze
 * Body: { transcript }
 * Uses Groq openai/gpt-oss-120b with response_format: json_object.
 * Returns { score, feedback_summary, strengths, weaknesses }.
 */
export async function analyze(req: Request, res: Response): Promise<void> {
  try {
    if (!groqApiKey) {
      res.status(503).json({ success: false, error: 'Analyze service not configured (missing GROQ_API_KEY)' });
      return;
    }

    const { transcript } = req.body as AnalyzeRequestBody;
    const transcriptStr = typeof transcript === 'string' ? transcript : '';

    if (!transcriptStr.trim()) {
      res.status(400).json({ success: false, error: 'transcript is required' });
      return;
    }

    const groq = new Groq({ apiKey: groqApiKey });

    const completion = await groq.chat.completions.create({
      model: ANALYZE_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ANALYZE },
        {
          role: 'user',
          content: `Analyze this interview transcript and output strictly valid JSON with: score (number 0-100), feedback_summary (string), strengths (array of strings), weaknesses (array of strings).\n\nTranscript:\n---\n${transcriptStr}\n---`,
        },
      ],
      max_tokens: 2048,
      temperature: 0.3,
      // same reasoning-token caveat as chat: without a cap, long reasoning can
      // exhaust max_tokens and truncate the JSON
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!text) {
      res.status(502).json({ success: false, error: 'Empty response from analysis model' });
      return;
    }

    let parsed: AnalyzeResult;
    try {
      parsed = JSON.parse(text) as AnalyzeResult;
    } catch {
      res.status(502).json({ success: false, error: 'Analysis model did not return valid JSON' });
      return;
    }

    const score = typeof parsed.score === 'number' ? parsed.score : Number(parsed.score) || 0;
    const feedback_summary = typeof parsed.feedback_summary === 'string' ? parsed.feedback_summary : '';
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [];
    const weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [];

    res.json({
      success: true,
      data: { score, feedback_summary, strengths, weaknesses },
    });
  } catch (err) {
    if (isRateLimitError(err)) {
      res.status(503).json({ success: false, error: 'Server busy. Please try again in a moment.' });
      return;
    }
    console.error('[interview] analyze:', err);
    res.status(500).json({ success: false, error: 'Failed to analyze transcript' });
  }
}
