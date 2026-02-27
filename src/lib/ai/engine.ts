// ---------------------------------------------------------------------------
// AI Engine — wraps the Anthropic SDK to provide structured market analysis
// and hit/miss post-mortem capabilities for the Kalshi AI Trader.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";

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

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

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
  private client: Anthropic;

  constructor() {
    // The Anthropic SDK reads ANTHROPIC_API_KEY from the environment by default.
    this.client = new Anthropic();
  }

  /**
   * Sends market data to Claude and returns a structured trade recommendation.
   * Returns `null` if the call or parsing fails.
   */
  async analyzeMarket(
    params: MarketAnalysisPromptParams,
  ): Promise<AIAnalysis | null> {
    try {
      const prompt = buildMarketAnalysisPrompt(params);

      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      });

      // Extract the text content from the response
      const textBlock = response.content.find(
        (block) => block.type === "text",
      );
      if (!textBlock || textBlock.type !== "text") {
        console.error("[AIEngine] No text block in Claude response");
        return null;
      }

      const parsed = extractJSON<unknown>(textBlock.text);
      return validateAIAnalysis(parsed);
    } catch (error) {
      console.error("[AIEngine] analyzeMarket failed:", error);
      return null;
    }
  }

  /**
   * Sends resolved bet details to Claude for post-mortem analysis.
   * Returns `null` if the call or parsing fails.
   */
  async analyzeOutcome(
    params: HitMissAnalysisPromptParams,
  ): Promise<HitMissAnalysis | null> {
    try {
      const prompt = buildHitMissAnalysisPrompt(params);

      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      });

      // Extract the text content from the response
      const textBlock = response.content.find(
        (block) => block.type === "text",
      );
      if (!textBlock || textBlock.type !== "text") {
        console.error("[AIEngine] No text block in Claude response");
        return null;
      }

      const parsed = extractJSON<unknown>(textBlock.text);
      return validateHitMissAnalysis(parsed);
    } catch (error) {
      console.error("[AIEngine] analyzeOutcome failed:", error);
      return null;
    }
  }
}

// ---- Singleton ------------------------------------------------------------

export const aiEngine = new AIEngine();
