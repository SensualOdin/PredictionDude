// ---------------------------------------------------------------------------
// AI Engine — wraps the OpenAI-compatible SDK to provide structured market
// analysis and hit/miss post-mortem capabilities for the Kalshi AI Trader.
// Currently using Kimi K2.5 (Moonshot AI).
// ---------------------------------------------------------------------------

import OpenAI from "openai";

import {
  buildMarketAnalysisPrompt,
  buildHitMissAnalysisPrompt,
  type MarketAnalysisPromptParams,
  type HitMissAnalysisPromptParams,
} from "./prompts";

// ---- Types ----------------------------------------------------------------

export type Recommendation = "BUY_YES" | "BUY_NO" | "SKIP";

export interface AIAnalysis {
  recommendation: Recommendation;
  confidence: number;
  suggested_size: number;
  reasoning: string;
  key_risk: string;
  data_sources: string[];
}

export interface HitMissAnalysis {
  thesis_correct: boolean;
  reasoning: string;
  patterns: string[];
  proposed_update: string;
}

// ---- Constants ------------------------------------------------------------

const MODEL = "kimi-k2-0711";
const MAX_TOKENS = 4096;

// ---- Helpers --------------------------------------------------------------

/**
 * Extracts a JSON object from a string that may or may not be wrapped in
 * markdown code fences (```json ... ``` or ``` ... ```).
 */
function extractJSON<T>(raw: string): T {
  // Strip optional markdown code fences
  let cleaned = raw.trim();

  // Handle ```json ... ``` or ``` ... ```
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  return JSON.parse(cleaned) as T;
}

/**
 * Validates that the parsed object has the expected shape for AIAnalysis.
 */
function validateAIAnalysis(obj: unknown): AIAnalysis {
  const data = obj as Record<string, unknown>;

  const validRecommendations: Recommendation[] = ["BUY_YES", "BUY_NO", "SKIP"];
  const recommendation = data.recommendation as string;
  if (!validRecommendations.includes(recommendation as Recommendation)) {
    throw new Error(
      `Invalid recommendation: ${recommendation}. Expected one of: ${validRecommendations.join(", ")}`,
    );
  }

  return {
    recommendation: recommendation as Recommendation,
    confidence: Number(data.confidence),
    suggested_size: Number(data.suggested_size),
    reasoning: String(data.reasoning ?? ""),
    key_risk: String(data.key_risk ?? ""),
    data_sources: Array.isArray(data.data_sources)
      ? data.data_sources.map(String)
      : [],
  };
}

/**
 * Validates that the parsed object has the expected shape for HitMissAnalysis.
 */
function validateHitMissAnalysis(obj: unknown): HitMissAnalysis {
  const data = obj as Record<string, unknown>;

  return {
    thesis_correct: Boolean(data.thesis_correct),
    reasoning: String(data.reasoning ?? ""),
    patterns: Array.isArray(data.patterns) ? data.patterns.map(String) : [],
    proposed_update: String(data.proposed_update ?? "none"),
  };
}

// ---- Engine ---------------------------------------------------------------

export class AIEngine {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.KIMI_API_KEY,
      baseURL: "https://api.moonshot.cn/v1",
    });
  }

  /**
   * Sends market data to Kimi and returns a structured trade recommendation.
   * Returns `null` if the call or parsing fails.
   */
  async analyzeMarket(
    params: MarketAnalysisPromptParams,
  ): Promise<AIAnalysis | null> {
    try {
      const prompt = buildMarketAnalysisPrompt(params);

      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "system",
            content: "You are an expert sports betting analyst. Always respond with valid JSON only, no extra text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        console.error("[AIEngine] No text in Kimi response");
        return null;
      }

      const parsed = extractJSON<unknown>(text);
      return validateAIAnalysis(parsed);
    } catch (error) {
      console.error("[AIEngine] analyzeMarket failed:", error);
      return null;
    }
  }

  /**
   * Sends resolved bet details to Kimi for post-mortem analysis.
   * Returns `null` if the call or parsing fails.
   */
  async analyzeOutcome(
    params: HitMissAnalysisPromptParams,
  ): Promise<HitMissAnalysis | null> {
    try {
      const prompt = buildHitMissAnalysisPrompt(params);

      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "system",
            content: "You are an expert sports betting analyst doing post-mortem analysis. Always respond with valid JSON only, no extra text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        console.error("[AIEngine] No text in Kimi response");
        return null;
      }

      const parsed = extractJSON<unknown>(text);
      return validateHitMissAnalysis(parsed);
    } catch (error) {
      console.error("[AIEngine] analyzeOutcome failed:", error);
      return null;
    }
  }
}

// ---- Singleton ------------------------------------------------------------

export const aiEngine = new AIEngine();
