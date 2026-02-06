import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { agent, StructuredResponseSchema } from "./agent.js";
import type { StateSnapshot, StateType } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { z } from "zod/v4";

async function main() {
  const config: RunnableConfig = {
    configurable: {
      thread_id: "test-thread-123",
      version: "v2",
    },
  };

  console.log("--- Starting Agent Execution ---");

  const stream = await agent.stream(
    {
      messages: [new HumanMessage("Research 'minimal reproduction'")],
    },
    { ...config, streamMode: "updates", recursionLimit: 10 },
  );

  for await (const chunk of stream) {
    console.log(chunk)
  }
  console.log("\n--- Stream Finished ---");

  // {
  //   summary: "Mock research for 'minimal reproduction' was conducted and useful insights were found.",
  //   status: 'completed'
  // }
  // console.log(structuredResponse);

  type FinalState = Omit<StateSnapshot, "values"> & {
    values: {
      messages: BaseMessage[];
      structuredResponse: z.infer<typeof StructuredResponseSchema>
    };
  };
  const finalState: FinalState = await agent.getState(config)
  console.log('structuredResponse ==> ', finalState.values.structuredResponse)
}

main().catch(console.error);
