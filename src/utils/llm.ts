interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StreamResponse {
  choices: Array<{
    delta: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
}

export const fetchLLMStream = async (
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onUpdate: (chunk: string, isReasoning: boolean) => void,
) => {
  let url = apiUrl || "https://api.openai.com/v1/chat/completions";

  // Auto-fix some common URL mistakes
  if (!url.includes("chat/completions") && !url.includes("/v1/messages")) {
    // Allow anthropic standard
    if (url.endsWith("/")) {
      url += "v1/chat/completions";
    } else {
      url += "/v1/chat/completions";
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `HTTP error! status: ${response.status}`,
    );
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8");

  if (!reader) throw new Error("No reader available");

  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let lines = buffer.split("\n");
    buffer = lines.pop() || ""; // keep the last partial line in buffer

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("data: ") && trimmedLine !== "data: [DONE]") {
        try {
          const data: StreamResponse = JSON.parse(trimmedLine.slice(6));
          if (data.choices[0]?.delta?.reasoning_content) {
            onUpdate(data.choices[0].delta.reasoning_content, true);
          }
          if (data.choices[0]?.delta?.content) {
            onUpdate(data.choices[0].delta.content, false);
          }
        } catch (e) {
          // If it fails to parse but isn't empty, just log a warning instead of dropping everything
          if (trimmedLine.length > 0) {
            console.warn("Parse error for chunk:", trimmedLine, e);
          }
        }
      }
    }
  }
};
