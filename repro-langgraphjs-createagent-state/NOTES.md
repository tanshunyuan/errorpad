# How does `createAgent` with `responseFormat` work?

this is the codeblock

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
  checkpointer: new MemorySaver()
});
```

how does the agent know how to respond with the responseSchema?

## Workings
Instead of relying on `.withStructuredOutput` from the llms. A more reliable way is formating the response through a forced **tool call**.

The flow looks like this:
1. **Create a tool** that defines the response format
2. **Force model to make tool calls** via `tool_choice: "any"`
3. **Model returns**: `tool_calls: [{ name: "extract-1", args: { status, summary } }]`
4. **Tool parses arguments** → Returns: `{ status: "completed", summary: "blah blah..." }

### Tool Creation
```ts
ToolStrategy.fromSchema(z.object({ status: string, summary: string }))
  ↓
Creates tool definition:
{
  type: "function",
  function: {
    name: "extract-1",  // Auto-generated name
    description: "Tool for extracting structured output...",
    parameters: { 
      type: "object",
      properties: { status: {...}, summary: {...} }
    }
  }
}
```

### Bind Tools
```ts
const structuredTools = structuredResponseFormat.tools
const allTools = [...regularTools, ...structuredTools.map(t => t.tool)]
const toolChoice = structuredTools.length > 0 ? "any" : undefined
const modelWithTools = await bindTools(model, allTools, { tool_choice })
```

### Model Returns AIMessage
```ts
const response = await modelWithTools.invoke(messages)
// Returns: AIMessage
{
  type: "ai",
  content: "I'll extract the information for you.",
  tool_calls: [
    {
      id: "call-abc123",
      name: "extract-1",
      args: { name: "John", age: 30 }  // ← Structured data in tool call
    }
  ]
}
```

### Parse Structured Response
```ts
const structuredResponse = toolStrategy.parse(toolCall.args)
// → { name: "John", age: 30 }
```

## Complete flow
```txt
1. User creates agent with responseFormat:
   createAgent({
     responseFormat: z.object({ name: string, age: number })
   })

2. Transform to ToolStrategy:
   - Tool definition created with name="extract-1"
   - Parameters match response format schema

3. Bind tools to model:
   - modelWithTools includes "extract-1" tool
   - tool_choice="any" forces tool selection

4. Model invoked:
   - Model forced to call tool (can't return text)
   - Chooses "extract-1" and returns: { args: { name, age } }

5. Parse tool arguments:
   - Zod validator ensures structure matches schema
   - Returns: { name: "John", age: 30 }

6. Return structured response:
   - agent.invoke().structuredResponse = { name: "John", age: 30 }
   - messages array contains AIMessage with tool_calls
```
