import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { country, category } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Generating survey suggestions for country: ${country}, category: ${category}`);

    const systemPrompt = `You are a creative survey suggestion generator for a community polling platform called PulseVote. 
Generate engaging, thought-provoking survey questions that will spark discussion and get people voting.

Rules:
- Generate 5 diverse survey suggestions
- Each survey should have 2-4 answer options
- Mix serious topics with fun/entertaining ones
- Include current events, everyday objects, trending topics, and fun scenarios
- Make questions relevant to the specified country/region when provided
- Keep questions neutral and non-offensive
- Include a brief image description for each survey (for AI image generation)

Return JSON in this exact format:
{
  "suggestions": [
    {
      "title": "Survey question here?",
      "description": "Brief context or explanation",
      "options": ["Option A", "Option B", "Option C"],
      "imagePrompt": "Description for generating an image",
      "category": "one of: cooking, sports, politics, relationships, scandals, music, spirituality, science, fun"
    }
  ]
}`;

    const userPrompt = country && country !== 'all'
      ? `Generate 5 survey suggestions relevant to ${country}. ${category ? `Focus on ${category} topics.` : 'Mix different categories including news, everyday items, trends, and fun topics.'}`
      : `Generate 5 global survey suggestions. ${category ? `Focus on ${category} topics.` : 'Mix different categories including international news, everyday items like household objects, trending topics, and fun entertainment scenarios.'}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_surveys",
              description: "Generate survey suggestions with options and image prompts",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        options: { 
                          type: "array", 
                          items: { type: "string" }
                        },
                        imagePrompt: { type: "string" },
                        category: { type: "string" }
                      },
                      required: ["title", "description", "options", "imagePrompt", "category"]
                    }
                  }
                },
                required: ["suggestions"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_surveys" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI Response received");

    // Parse the tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const suggestions = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(suggestions), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(suggestions), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    throw new Error("Failed to parse AI response");
  } catch (error) {
    console.error("Error in generate-survey-suggestions:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
