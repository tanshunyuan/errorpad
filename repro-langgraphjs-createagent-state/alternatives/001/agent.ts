import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createAgent } from "langchain";
import { SystemMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { env } from "../../env.js";

export const responseSchema = z.object({
  status: z.enum(["completed", "error"]),
  summary: z.string().describe("A summary of the findings"),
});

const mockResearchTool = tool(
  async ({ query }) => {
    console.log(`[Tool] Executing research for: ${query}`);
    // Simulate an async operation
    await new Promise((resolve) => setTimeout(resolve, 500));
    return `Here is some mock data for "${query}". It contains useful insights.`;
  },
  {
    name: "mock_research",
    description: "Fetches mock research data for a given query.",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  },
);

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: env.GOOGLE_API_KEY,
});

export const agent = createAgent({
  model: llm,
  tools: [mockResearchTool],
  systemPrompt: new SystemMessage(
    "You are a research assistant. Use the mock_research tool to gather data",
  ),
  responseFormat: responseSchema,
  checkpointer: new MemorySaver()
});
