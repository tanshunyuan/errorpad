import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { SystemMessage } from "@langchain/core/messages";
import {
  END,
  MemorySaver,
  MessagesValue,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import { env } from "../../env.js";
import { ToolNode } from "@langchain/langgraph/prebuilt";

export const StructuredResponseSchema = z.object({
  status: z.enum(["completed", "error"]),
  summary: z.string(),
});

const OverallState = new StateSchema({
  messages: MessagesValue,
  structuredResponse: StructuredResponseSchema.optional(),
});

const mockResearchTool = tool(
  async ({ query }) => {
    console.log(`[Tool] Executing research for: ${query}`);
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

const tools = [mockResearchTool];
const toolNode = new ToolNode(tools);

const graph = new StateGraph({
  state: OverallState,
})
  .addNode("researcherNode", async (state, config) => {
    const llmWithTools = llm
      .bindTools(tools)
      .withStructuredOutput(StructuredResponseSchema);

    const RESEARCHER_SYSTEM_MESSAGE = new SystemMessage(
      `You are a research assistant. Use the mock_research tool to gather data, then return a structured response with status and summary.`,
    );

    const structuredResponse = await llmWithTools.invoke([
      RESEARCHER_SYSTEM_MESSAGE,
      ...state.messages,
    ]);

    return {
      structuredResponse,
    };
  })
  .addNode("toolNode", toolNode)
  .addEdge(START, "researcherNode")
  .addConditionalEdges(
    "researcherNode",
    (state) => {
      const lastMessage = state.messages.at(-1);
      const hasToolCalls = lastMessage?.tool_calls?.length;

      if (hasToolCalls) return "toolNode";
      return END;
    },
    ["toolNode", END],
  )
  .addEdge("toolNode", "researcherNode");

export const agent = graph.compile({
  checkpointer: new MemorySaver(),
});
