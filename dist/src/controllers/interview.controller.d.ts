import type { Request, Response } from 'express';
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
/**
 * POST /api/chat
 * Body matches frontend Redux (state.interview): { history, domain?, difficulty?, focusTopic? }
 * Uses Groq openai/gpt-oss-20b. On 429 returns friendly "Server Busy" message.
 */
export declare function chat(req: Request, res: Response): Promise<void>;
/**
 * POST /api/analyze
 * Body: { transcript }
 * Uses Groq openai/gpt-oss-120b with response_format: json_object.
 * Returns { score, feedback_summary, strengths, weaknesses }.
 */
export declare function analyze(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=interview.controller.d.ts.map