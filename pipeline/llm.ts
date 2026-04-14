import {
  OPENROUTER_BASE_URL,
  OPENROUTER_MODEL,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
} from "./constants";

export const use_openrouter = false;

export interface LlmRequest {
  system: string;
  prompt: string;
  images?: string[]; // base64 strings
  format?: any; // JSON schema or indicator
  options?: {
    temperature?: number;
    top_p?: number;
  };
}

export async function llmCall(req: LlmRequest): Promise<string> {
  if (use_openrouter) {
    // Make call to OpenRouter API (OpenAI compatible format)
    const messages: any[] = [];
    if (req.system) {
      messages.push({ role: "system", content: req.system });
    }
    
    let userContent: any[] = [{ type: "text", text: req.prompt }];
    
    if (req.images && req.images.length > 0) {
      req.images.forEach(img => {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${img}` },
        });
      });
    }
    
    messages.push({ role: "user", content: userContent });
    
    const body: any = {
      model: OPENROUTER_MODEL,
      messages: messages,
    };
    
    if (req.options && req.options.temperature !== undefined) {
      body.temperature = req.options.temperature;
    }
    if (req.options && req.options.top_p !== undefined) {
      body.top_p = req.options.top_p;
    }
    
    if (req.format) {
       body.response_format = { type: "json_object" };
    }
    
    const apiKey = process.env.OPENROUTER_API_KEY || "";

    const res = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AutoCRO",
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter responded with ${res.status}: ${errText}`);
    }
    
    const data = await res.json();
    return String(data.choices[0].message.content).trim();
    
  } else {
    // Make call to Ollama generate API
    const body: any = {
      model: OLLAMA_MODEL,
      system: req.system,
      prompt: req.prompt,
      stream: false,
    };
    
    if (req.images) body.images = req.images;
    if (req.format) body.format = req.format;
    if (req.options) body.options = req.options;
    
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama responded with ${res.status}: ${errText}`);
    }
    
    const data = await res.json();
    return String(data.response ?? "").trim();
  }
}
