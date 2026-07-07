const Anthropic = require("@anthropic-ai/sdk");

let client = null;
const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
};

/**
 * Use Claude AI to predict wait time for a token in the queue.
 * Returns null if the API key is not configured (callers fall back to simple math).
 */
async function predictWaitTime({
  position,
  aheadBreakdown,
  avgServiceMinutes,
  avgWaitMinutes,
  totalWaiting,
  priority,
  timeOfDay,
}) {
  const ai = getClient();
  if (!ai) return null;

  const prompt = `You are a queue management AI assistant. Analyze the following real-time queue data and predict the estimated wait time for a specific user.

Queue data:
- User's queue position: ${position + 1} (${position} people ahead)
- People ahead by priority: Emergency=${aheadBreakdown.emergency ?? 0}, Authorized=${aheadBreakdown.authorized ?? 0}, Senior=${aheadBreakdown.senior ?? 0}, Normal=${aheadBreakdown.normal ?? 0}
- Historical average service time per person: ${avgServiceMinutes != null ? `${avgServiceMinutes} min` : "no data yet"}
- Historical average wait time (join to being called): ${avgWaitMinutes != null ? `${avgWaitMinutes} min` : "no data yet"}
- Total people currently waiting: ${totalWaiting}
- This user's priority: ${priority}
- Current time: ${timeOfDay}

Rules:
- Priority order (highest to lowest): Emergency > Authorized > Senior > Normal.
- Emergency tokens may have slightly longer service (5+ min), normal tokens ~3 min.
- If historical data is unavailable, use 3–4 minutes per person as baseline.
- Give a realistic range (±20% of estimate).
- Confidence should be "high" if historical data exists and queue is stable, "medium" if partial data, "low" if no history.

Respond ONLY with valid JSON, no markdown, no explanation outside JSON:
{
  "estimatedMinutes": <integer>,
  "minMinutes": <integer>,
  "maxMinutes": <integer>,
  "confidence": "high" | "medium" | "low",
  "reasoning": "<one concise sentence explaining the estimate>"
}`;

  try {
    const message = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].text.trim();
    const parsed = JSON.parse(text);

    if (
      typeof parsed.estimatedMinutes !== "number" ||
      typeof parsed.minMinutes !== "number" ||
      typeof parsed.maxMinutes !== "number"
    ) {
      throw new Error("Unexpected AI response shape");
    }

    return parsed;
  } catch (err) {
    console.error("AI wait prediction failed:", err.message);
    return null;
  }
}

module.exports = { predictWaitTime };
