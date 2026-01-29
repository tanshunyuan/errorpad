# Missing `structuredResponse` when retrieving agent state via `.getState`

This repository serves as a minimal reproduction case for an issue encountered when using `createAgent` with `responseFormat` in LangGraph.js.

## 🛠️ Setup

1.  **Install dependencies**
    We use `pnpm` as the package manager, but `npm` or `yarn` will work as well.

    ```bash
    pnpm install
    ```

2.  **Configure environment variables**
    Create a `.env` file in the root directory and add your Google API Key:

    ```ini
    GOOGLE_API_KEY=your_api_key_here
    ```

3.  **Run the reproduction**
    ```bash
    pnpm dev
    ```

## 🐛 The Issue

When using `createAgent` with a structured `responseFormat`, the agent correctly executes the tools and generates the structured response. However, the final structured output is **not** available in the graph state via `.getState()`.

The agent is created with a Zod schema in `agent.ts`:

```ts
const responseSchema = z.object({
  status: z.enum(["completed", "error"]),
  summary: z.string().describe("A summary of the findings"),
});

export const agent = createAgent({
  model: llm,
  tools: [mockResearchTool],
  systemPrompt: new SystemMessage(
    "You are a research assistant. Use the mock_research tool to gather data, then return a structured response.",
  ),
  responseFormat: responseSchema,
  checkpointer: new MemorySaver(),
});
```

However, when we use `.getState()` in `index.ts` to inspect the result:

```ts
const finalState = await agent.getState(config);
const values = finalState.values;
const structuredResponse = values.structuredResponse;
```

### Expected Behavior

I expected `values.structuredResponse` to contain the structured object matching the `responseSchema`.

```ts
// Expected Output:
// {
//   status: "completed",
//   summary: "Mock research data for 'minimal reproduction' has been retrieved..."
// }
```

### Actual Behavior

Instead, the `structuredResponse` key doesn't exist, and I have to manually dig through the `values.messages` array to find it.

The structured output is buried inside the content of a ToolMessage (specifically the one with name: "extract-2"), which is the second last message.

> Note: To see the full raw log of the `finalState` object, refer to `index.ts` starting at line 30.

```ts
values: {
  messages: [
    // trimmed object
    ToolMessage {
      "id": "8fa99e6b-bf2f-4e79-9253-102218c40651",
      "content": "{\"summary\":\"Mock research data for 'minimal reproduction' has been retrieved, containing useful insights.\",\"status\":\"completed\"}",
      "name": "extract-2",
      "additional_kwargs": {},
      "response_metadata": {},
      "tool_call_id": "c4085f98-c686-451d-bffa-bf1b2118225f"
    },
    AIMessage {
      "id": "8e3fa287-c98e-4c45-a47e-a9f864c0059b",
      "content": "Returning structured response: {\"summary\":\"Mock research data for 'minimal reproduction' has been retrieved, containing useful insights.\",\"status\":\"completed\"}",
      "additional_kwargs": {},
      "response_metadata": {},
      "tool_calls": [],
      "invalid_tool_calls": []
    }
  ]
}
```

## 🤔 Questions & API Concerns

While working on this reproduction, I noticed a few things about the LangGraph.js API that raised questions:

1.  **How to properly type `.getState()`?**
    TypeScript types the `values` as `never` or `any`, forcing manual casts. Can the state schema be inferred automatically from `createAgent`?

2.  **Is `.getState()` an internal API?**
    If `getState` is meant for internal use only, what is the recommended public API for retrieving the final state after streaming?

3.  **Is `.streamEvents()` an internal API?**
    `streamEvents` is used UI updates. If it's internal, what is the stable alternative for streaming tokens and tool events?
