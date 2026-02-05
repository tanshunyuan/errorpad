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

const structuredResponseTool = ToolStrategy.fromSchema(StructuredResponseSchema);

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
  .addNode("agent", async (state, config) => {
    const SYSTEM_MESSAGE = new SystemMessage(
      `You are a research assistant. Use the mock_research tool to gather data, then call ResearchResponse with status and summary.`,
    );

    const response = await modelWithResponseTool.invoke([
      SYSTEM_MESSAGE,
      ...state.messages,
    ]);
    console.log('response ==> ', response)

    return {
      messages: [response],
    };
  })
  .addNode("respond", async (state, config) => {
    const lastMessage = state.messages.at(-1);

    if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
      return {};
    }

    const researchToolCall = lastMessage.tool_calls?.[0];

    if (!researchToolCall) {
      return {};
    }

    const structuredResponse = structuredResponseTool.parse(
      researchToolCall.args,
    );

    const toolMessage = new ToolMessage({
      content: "Here is your structured response",
      tool_call_id: researchToolCall.id ?? "",
      name: researchToolCall.name,
    });

    return {
      structuredResponse,
      messages: [toolMessage],
    };
  })
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges(
    "agent",
    (state) => {
      const lastMessage = state.messages.at(-1);

      if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
        return END;
      }

      const toolCalls = lastMessage.tool_calls ?? [];

      if (toolCalls.length === 1 && toolCalls[0].name === structuredResponseTool.name) {
        return "respond";
      }

      return "continue";
    },
    {
      continue: "tools",
      respond: "respond",
    },
  )
  .addEdge("tools", "agent")
  .addEdge("respond", END);

export const agent = graph.compile({
  checkpointer: new MemorySaver(),
});
