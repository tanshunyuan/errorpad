import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { agent, responseSchema } from "./agent.js";
import type { StateSnapshot, StateType } from "@langchain/langgraph";

async function main() {
  const config = {
    configurable: {
      thread_id: "test-thread-123",
      version: "v2",
    },
  };

  console.log("--- Starting Agent Execution ---");

  const stream = agent.streamEvents(
    {
      messages: [new HumanMessage("Research 'minimal reproduction'")],
    },
    { ...config },
  );

  let structuredResponse;
  for await (const event of stream) {
    console.log('event ==> ', event)
    const eventName = event.event;
    const eventData = event.data;
    if (eventName === "on_chat_model_stream") {
      // Just visual feedback that things are running
      process.stdout.write(".");
    }
    if (eventName === "on_chain_end") {
      structuredResponse = eventData.output.structuredResponse;
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
