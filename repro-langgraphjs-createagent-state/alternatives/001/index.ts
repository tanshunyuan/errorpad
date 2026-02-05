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

  for await (const event of stream) {
    console.log('event ==> ', event)
    if (event.event === "on_chat_model_stream") {
      // Just visual feedback that things are running
      process.stdout.write(".");
    }
  }
  console.log("\n--- Stream Finished ---");

  type FinalState = Omit<StateSnapshot, "values"> & {
    values: {
      messages: BaseMessage[];
    };
  };
  const finalState: FinalState = await agent.getState(config);
  const messages = finalState.values.messages;
  // [
  //   ToolMessage {
  //     "id": "b2e4098c-f4e1-41d2-b69e-e0aec9f46877",
  //     "content": "{\"summary\":\"Mock research for 'minimal reproduction' was conducted, and the results indicate that it 'contains useful insights'.\",\"status\":\"completed\"}",
  //     "name": "extract-2",
  //     "additional_kwargs": {},
  //     "response_metadata": {},
  //     "tool_call_id": "2b15168d-af6a-423f-80fe-9619b812752d"
  //   },
  //   AIMessage {
  //     "id": "fe657c25-0924-4b20-8839-1ec60f56af4e",
  //     "content": "Returning structured response: {\"summary\":\"Mock research for 'minimal reproduction' was conducted, and the results indicate that it 'contains useful insights'.\",\"status\":\"completed\"}",
  //     "additional_kwargs": {},
  //     "response_metadata": {},
  //     "tool_calls": [],
  //     "invalid_tool_calls": []
  //   }
  // ]
  const structuredOutputToolMessage = messages.at(-2);
  const content = structuredOutputToolMessage!.content;
  const structuredResponse = {
    structuredResponse: responseSchema.parse(JSON.parse(content as string)),
  };
  console.log(structuredResponse);
  // {
  //   structuredResponse: {
  //     status: 'completed',
  //     summary: "Research on 'minimal reproduction' has been completed. The findings indicate useful insights into the topic."
  //   }
  // }
}

main().catch(console.error);
