import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { ToolStrategy } from "langchain";
import {
  SystemMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  Command,
  END,
  MemorySaver,
  MessagesValue,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { env } from "../../env.js";

export const StructuredResponseSchema = z.object({
  status: z.enum(["completed", "error"]),
  summary: z.string(),
});

const OverallState = new StateSchema({
  messages: MessagesValue,
  structuredResponse: StructuredResponseSchema.optional(),
});

const mockResearchTool = tool(
  async ({ query }: { query: string }) => {
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

const structuredResponseTool = ToolStrategy.fromSchema(
  StructuredResponseSchema,
);

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: env.GOOGLE_API_KEY,
});

// Bind both tools for the LLM to see
const tools = [mockResearchTool, structuredResponseTool];
const modelWithResponseTool = llm.bindTools(tools, { tool_choice: "any" });

// ToolNode only works with executable tools (not ToolStrategy)
const executableTools = [mockResearchTool];
const toolNode = new ToolNode(executableTools);

const graph = new StateGraph({
  state: OverallState,
})
  .addNode("researcherNode", async (state, config) => {
    const SYSTEM_MESSAGE = new SystemMessage(
      `You are a research assistant. Use the mock_research tool to gather data, then call ResearchResponse with status and summary.`,
    );

    const response = await modelWithResponseTool.invoke([
      SYSTEM_MESSAGE,
      ...state.messages,
    ]);

    return {
      messages: [response],
    };
  })
  .addNode("toolNode", toolNode)
  .addNode("respondNode", async (state, config) => {
    const lastMessage = state.messages.at(-1);

    const hasNoAIMessage = !lastMessage || !AIMessage.isInstance(lastMessage);
    if (hasNoAIMessage) return {};

    const researchToolCall = lastMessage.tool_calls?.[0];
    if (!researchToolCall) return {};

    const structuredResponse = structuredResponseTool.parse(
      researchToolCall.args,
    );

    const toolMessage = new ToolMessage({
      content: `Here is your structured response: ${JSON.stringify(researchToolCall.args)}`,
      tool_call_id: researchToolCall.id ?? "",
      name: researchToolCall.name,
    });

    return {
      structuredResponse,
      messages: [toolMessage],
    };
  })
  .addEdge(START, "researcherNode")
  .addConditionalEdges(
    "researcherNode",
    (state) => {
      const lastMessage = state.messages.at(-1);

      const hasNoAIMessage = !lastMessage || !AIMessage.isInstance(lastMessage);
      if (hasNoAIMessage) return END;

      const toolCalls = lastMessage.tool_calls ?? [];

      if (
        toolCalls.length === 1 &&
        toolCalls[0]?.name === structuredResponseTool.name
      ) {
        return "respondNode";
      }

      return "toolNode";
    },
    ["toolNode", "respondNode", END],
  )
  .addEdge("toolNode", "researcherNode")
  .addEdge("respondNode", END);

export const agent = graph.compile({
  checkpointer: new MemorySaver(),
});
