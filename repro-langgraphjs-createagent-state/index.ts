import { HumanMessage } from "@langchain/core/messages";
import { agent } from "./agent.js";

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
    if (event.event === "on_chat_model_stream") {
      // Just visual feedback that things are running
      process.stdout.write(".");
    }
  }
  console.log("\n--- Stream Finished ---");

  const finalState = await agent.getState(config);
  // {
  //   values: {
  //     messages: [
  //       HumanMessage {
  //         "id": "58c0e0b8-533c-4fde-b0a6-b73390ee14f3",
  //         "content": "Research 'minimal reproduction'",
  //         "additional_kwargs": {},
  //         "response_metadata": {}
  //       },
  //       AIMessageChunk {
  //         "id": "run-019c0850-8a62-7000-8000-0d958915598d",
  //         "content": [
  //           {
  //             "type": "functionCall",
  //             "functionCall": {
  //               "name": "mock_research",
  //               "args": "[Object]"
  //             }
  //           }
  //         ],
  //         "name": "model",
  //         "additional_kwargs": {
  //           "__gemini_function_call_thought_signatures__": {
  //             "15dc4f39-85c7-4072-aa3f-36d164b727f0": "CiQBcsjafI+ilXyFhlhikItK7BoYsHz04qI+/gr0SATGRals4aYKdwFyyNp8vQXv+KJDiDYnhT0IHO+clT0KnGP5dXFjg3yJaxhwMw5PKY0oQP7dezPepGXdM4OYMdcTde1o1eXioqU3QVVyyjD5kdKIjerHAwCbIiqPoCNaVW+op1UZJVxKrhS0zk0bUYvfpHOX1TshH9T0lYU5v5OwCrgBAXLI2nxLLkG0nXfy8xegDkI9TZ2IuEy/y5GC5B9n93W80k4fjh6ePvJZqsZJ5+IR2MlyQ2t9WdmTnF2Q45sOC/s6jTbKxnseL0/VCmiublwVGr+fJNzTbqTKoh2Zo7yhlOiq/fFr/4dOmfDPQFm54KekObqhbzDpuT9IoF7vpax0wK/8pL0gukCvHJiX4RokWAxxVflV69KDg+aV4T+9OgNiPmj/M/RKqAjX/m3NUUEh2m2OLNnPpw=="
  //           }
  //         },
  //         "response_metadata": {
  //           "model_provider": "google-genai"
  //         },
  //         "tool_calls": [
  //           {
  //             "name": "mock_research",
  //             "args": {
  //               "query": "minimal reproduction"
  //             },
  //             "id": "15dc4f39-85c7-4072-aa3f-36d164b727f0",
  //             "type": "tool_call"
  //           }
  //         ],
  //         "tool_call_chunks": [
  //           {
  //             "type": "tool_call_chunk",
  //             "id": "15dc4f39-85c7-4072-aa3f-36d164b727f0",
  //             "name": "mock_research",
  //             "args": "{\"query\":\"minimal reproduction\"}"
  //           }
  //         ],
  //         "invalid_tool_calls": []
  //       },
  //       ToolMessage {
  //         "id": "71d3e1bc-daf6-4a3c-9eac-1eee2c9b1b47",
  //         "content": "Here is some mock data for \"minimal reproduction\". It contains useful insights.",
  //         "name": "mock_research",
  //         "additional_kwargs": {},
  //         "response_metadata": {},
  //         "tool_call_id": "15dc4f39-85c7-4072-aa3f-36d164b727f0"
  //       },
  //       AIMessageChunk {
  //         "id": "run-019c0850-9162-7000-8000-0f36804fc01a",
  //         "content": [
  //           {
  //             "type": "functionCall",
  //             "functionCall": {
  //               "name": "extract-2",
  //               "args": "[Object]"
  //             }
  //           }
  //         ],
  //         "name": "model",
  //         "additional_kwargs": {
  //           "__gemini_function_call_thought_signatures__": {
  //             "c4085f98-c686-451d-bffa-bf1b2118225f": "CiIBcsjafPMu/oD5e5VYNoBzmKT91e8GYVHU3xatWOiRTEgNCnoBcsjafC7TbqwKZKTsAgRkBa7pq0x97X5gAlnGTo1kglBqiRQ8XYFtBsVKj43DfphHdAv5MepGiEoMXOFLCVSa1Dmk4cLbJCDOmQsJ5I4Cg5wtCppjPYp0zQ7Jg7ty0jZyWjrOPNe68ODt/07P1ZjNRWQEyHxcl1D4egqJAgFyyNp8hwcTQ9iwjh9UZJYob+lPKXUNurxw0/rVMhWt6mEN1m6lipf7zW+9B+5a24NhuRIp7lWBKfeUoeSF3m2ggtEspy4EAyTRoZB4+coKDeo/AWrIapKz4/iS5jgL62uS1f+s/tMFx56DiW6NpDMcvuTyuvEuzD8U2z83FhX2sG5z5hcZ+CgWt5LrlIHI3279iwXm+KyFKzbPZ6oQidpShzxgNvKoFPMgJwuUTiI07d8LLa5hF60V555xpTPA7QlMhiK0AQtjdqg/AJR/bF491tpUWRecQu5t6heN7bRGROxIaRq6OvhsUmR8aLnO5P+LYM0B3jEfGmCjStFoVbtRuvxXz2r7jjcK3wEBcsjafDoABtRygHQIPsWlXtNpN8ePO4xtRD/O3qmqZ/yehNZGI6+uHhcMS4R7VOInfAAA7Di4EKNJe7tHSwiOmzUmXbqAgsM3sh3fMNQmxxMi/91+1t72lAhmfE2zaooeyzHaHQDam2Fg+FSYLwguttOakk8nIkV5QHV7SGp5Wy4SRJCMf8BzUcv8BFsDk6gQcw/fSDfzXWNe4Oxre5Pk8oogLtKokm2hIf1Hem7oGupw2emADYq38kQr4dYadwcGrgS5KXVnXEuIXCgLEV4sidRqewKR2wYMaN/JzEoh"
  //           }
  //         },
  //         "response_metadata": {
  //           "model_provider": "google-genai"
  //         },
  //         "tool_calls": [
  //           {
  //             "name": "extract-2",
  //             "args": {
  //               "summary": "Mock research data for 'minimal reproduction' has been retrieved, containing useful insights.",
  //               "status": "completed"
  //             },
  //             "id": "c4085f98-c686-451d-bffa-bf1b2118225f",
  //             "type": "tool_call"
  //           }
  //         ],
  //         "tool_call_chunks": [
  //           {
  //             "type": "tool_call_chunk",
  //             "id": "c4085f98-c686-451d-bffa-bf1b2118225f",
  //             "name": "extract-2",
  //             "args": "{\"summary\":\"Mock research data for 'minimal reproduction' has been retrieved, containing useful insights.\",\"status\":\"completed\"}"
  //           }
  //         ],
  //         "invalid_tool_calls": []
  //       },
  //       ToolMessage {
  //         "id": "8fa99e6b-bf2f-4e79-9253-102218c40651",
  //         "content": "{\"summary\":\"Mock research data for 'minimal reproduction' has been retrieved, containing useful insights.\",\"status\":\"completed\"}",
  //         "name": "extract-2",
  //         "additional_kwargs": {},
  //         "response_metadata": {},
  //         "tool_call_id": "c4085f98-c686-451d-bffa-bf1b2118225f"
  //       },
  //       AIMessage {
  //         "id": "8e3fa287-c98e-4c45-a47e-a9f864c0059b",
  //         "content": "Returning structured response: {\"summary\":\"Mock research data for 'minimal reproduction' has been retrieved, containing useful insights.\",\"status\":\"completed\"}",
  //         "additional_kwargs": {},
  //         "response_metadata": {},
  //         "tool_calls": [],
  //         "invalid_tool_calls": []
  //       }
  //     ]
  //   },
  //   next: [],
  //   tasks: [],
  //   metadata: {
  //     source: 'loop',
  //     step: 3,
  //     parents: {},
  //     thread_id: 'test-thread-123'
  //   },
  //   config: {
  //     configurable: {
  //       thread_id: 'test-thread-123',
  //       checkpoint_id: '1f0fcd6d-f8e4-6810-8003-981ba3db98e2',
  //       checkpoint_ns: ''
  //     }
  //   },
  //   createdAt: '2026-01-29T05:53:45.233Z',
  //   parentConfig: {
  //     configurable: {
  //       thread_id: 'test-thread-123',
  //       checkpoint_ns: '',
  //       checkpoint_id: '1f0fcd6d-eafc-6ef0-8002-03ca8970cc27'
  //     }
  //   }
  // }
  console.log(finalState)
}

main().catch(console.error);
