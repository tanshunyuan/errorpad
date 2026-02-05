import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { ToolStrategy } from "langchain";
import {
  AIMessage,
  SystemMessage,
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
  type StateSchemaField,
} from "@langchain/langgraph";
import { env } from "../../env.js";

const InputState = new StateSchema({
  messages: MessagesValue,
});

export const StructuredResponseSchema = z.object({
  status: z.enum(["completed", "error"]),
  summary: z.string(),
});

const OverallState = new StateSchema({
  messages: MessagesValue,
  structuredResponse: StructuredResponseSchema.optional(),
});

const OutputState = new StateSchema({
  structuredResponse: StructuredResponseSchema
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

const structuredResponseTool = ToolStrategy.fromSchema(
  z.object({
    status: z.enum(["completed", "error"]),
    summary: z.string(),
  }),
);

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: env.GOOGLE_API_KEY,
});

const TOOLS_MAP = {
  [mockResearchTool.name]: mockResearchTool,
  [structuredResponseTool.name]: structuredResponseTool,
};
const tools = Object.values(TOOLS_MAP);

const graph = new StateGraph({
  state: OverallState,
  input: InputState,
  output: OutputState,
})
  .addNode("researcherNode", async (state, config) => {
    const llmWTools = llm.bindTools(tools, { tool_choice: "any" });
    const RESEARCHER_SYSTEM_MESSAGE = new SystemMessage(
      `You are a research assistant. Use the mock_research tool to gather data`,
    );
    const response = await llmWTools.invoke([
      RESEARCHER_SYSTEM_MESSAGE,
      ...state.messages,
    ]);
    return new Command({
      update: {
        messages: response,
      },
    });
  })
  .addNode("toolNode", async (state, config) => {
    const lastMessage = state.messages.at(-1);

    const hasNoAIResponse = !lastMessage || !AIMessage.isInstance(lastMessage);
    if (hasNoAIResponse) return { messages: [] };

    const toolCalls = lastMessage.tool_calls ?? [];

    const messages: ToolMessage[] = [];
    let structuredResponse;

    // Process all tools at once
    await Promise.all(
      toolCalls.map(async (toolCall) => {
        const tool = TOOLS_MAP[toolCall.name];

        if ("parse" in tool) {
          const parsed = tool.parse(toolCall.args);
          messages.push(
            new ToolMessage({
              content: JSON.stringify(parsed),
              tool_call_id: toolCall.id,
            }),
          );
          structuredResponse = parsed;
          return;
        }

        const observation = await tool.invoke(toolCall);
        messages.push(observation);
      }),
    );

    return new Command({
      update: { messages, structuredResponse },
    });
  })
  .addEdge(START, "researcherNode")
  .addConditionalEdges(
    "researcherNode",
    (state, config) => {
      const lastMessage = state.messages.at(-1);

      const hasNoAIResponse =
        !lastMessage || !AIMessage.isInstance(lastMessage);
      if (hasNoAIResponse) return END;

      const hasStructuredResonse = state.structuredResponse;
      if (hasStructuredResonse) return END;

      const hasToolCalls = lastMessage.tool_calls?.length;
      if (hasToolCalls) return "toolNode";

      return END;
    },
    ["toolNode", END],
  )
  .addEdge("toolNode", "researcherNode");

export const agent = graph.compile({
  checkpointer: new MemorySaver(),
});
