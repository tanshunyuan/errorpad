import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { agent, responseSchema } from "./agent.js";
import type { StateSnapshot, StateType } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";

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
    { ...config, streamMode: "updates" },
  );

  let structuredResponse;
  for await (const chunk of stream) {
    if ("model_request" in chunk) {
      const modelRequest = chunk["model_request"];
      if ("structuredResponse" in modelRequest) {
        structuredResponse = modelRequest["structuredResponse"];
      }
    }
  }
  console.log("\n--- Stream Finished ---");

  // {
  //   summary: "Mock research for 'minimal reproduction' was conducted and useful insights were found.",
  //   status: 'completed'
  // }
  console.log(structuredResponse);
}

main().catch(console.error);
