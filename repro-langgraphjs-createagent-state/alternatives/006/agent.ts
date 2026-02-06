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

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: env.GOOGLE_API_KEY,
});

const tools = [mockResearchTool];

const graph = new StateGraph({
  state: OverallState,
})
  .addNode("researcherNode", async (state, config) => {
    const SYSTEM_MESSAGE = new SystemMessage(
      `You are a research assistant. Use the mock_research tool to gather data.`,
    );
    const modelWithTools = llm.bindTools(tools);

    const response = await modelWithTools.invoke([
      SYSTEM_MESSAGE,
      ...state.messages,
    ]);

    return {
      messages: [response],
    };
  })
  .addNode("toolNode", async (state, config) => {
    const toolNode = new ToolNode(tools);
    return await toolNode.invoke({
      messages: state.messages,
    });
  })
  .addNode("respondNode", async (state, config) => {
    const modelWithStructuredOutput = llm.withStructuredOutput(
      StructuredResponseSchema,
    );
    const response = await modelWithStructuredOutput.invoke(state.messages);

    return {
      structuredResponse: response,
    };
  })
  .addEdge(START, "researcherNode")
  .addConditionalEdges(
    "researcherNode",
    (state) => {
      const lastMessage = state.messages.at(-1);

      const hasNoAIMessage = !lastMessage || !AIMessage.isInstance(lastMessage);
      if (hasNoAIMessage) return END;

      const hasToolCalls = lastMessage.tool_calls?.length;
      if (hasToolCalls) return "toolNode";

      return "respondNode";
    },
    ["toolNode", "respondNode", END],
  )
  .addEdge("toolNode", "researcherNode")
  .addEdge("respondNode", END);

export const agent = graph.compile({
  checkpointer: new MemorySaver(),
});
