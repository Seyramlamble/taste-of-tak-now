import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Starting auto-publish surveys job...");

    // Get a random admin user to use as author
    const { data: adminRole, error: adminError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (adminError || !adminRole) {
      console.error("No admin user found:", adminError);
      throw new Error("No admin user found to publish surveys");
    }

    const authorId = adminRole.user_id;
    console.log("Using admin author:", authorId);

    // Get available preferences for categorization
    const { data: preferences, error: prefError } = await supabase
      .from('preferences')
      .select('*');

    if (prefError) {
      console.error("Error fetching preferences:", prefError);
      throw new Error("Failed to fetch preferences");
    }

    // Generate survey suggestions using AI
    const systemPrompt = `You are a creative survey suggestion generator for a community polling platform called VoiceHub. 
Generate engaging, thought-provoking survey questions that will spark discussion and get people voting.

Rules:
- Generate exactly 5 diverse survey suggestions
- Each survey should have 2-4 answer options
- Mix serious topics with fun/entertaining ones
- Include current events, everyday objects, trending topics, and fun scenarios
- Keep questions neutral and non-offensive
- Include a brief image description for each survey

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

    const userPrompt = "Generate 5 global survey suggestions. Mix different categories including international news, everyday items, trending topics, and fun entertainment scenarios. Make them engaging and suitable for a worldwide audience.";

    console.log("Calling AI to generate suggestions...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    // Parse the suggestions
    let suggestions: any[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      suggestions = parsed.suggestions || [];
    } else {
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          suggestions = parsed.suggestions || [];
        }
      }
    }

    if (suggestions.length === 0) {
      throw new Error("No suggestions generated");
    }

    console.log(`Generated ${suggestions.length} suggestions, publishing...`);

    const categoryMap: { [key: string]: string } = {
      'cooking': 'Cooking',
      'sports': 'Sports',
      'politics': 'Politics',
      'relationships': 'Relationships',
      'scandals': 'Scandals',
      'music': 'Music',
      'spirituality': 'Spirituality',
      'science': 'Science',
      'fun': 'Fun'
    };

    const publishedSurveys: string[] = [];

    // Publish each suggestion
    for (const suggestion of suggestions) {
      try {
        // Find matching preference
        const categoryName = categoryMap[suggestion.category?.toLowerCase()] || suggestion.category;
        const matchingPref = preferences?.find(
          (p: any) => p.name.toLowerCase() === categoryName?.toLowerCase()
        );

        // Insert the survey
        const { data: survey, error: surveyError } = await supabase
          .from('surveys')
          .insert({
            title: suggestion.title,
            description: suggestion.description,
            author_id: authorId,
            is_published: true,
            preference_id: matchingPref?.id || null,
            target_country: null,
            image_url: null,
            allow_multiple_answers: false
          })
          .select()
          .single();

        if (surveyError) {
          console.error("Error creating survey:", surveyError);
          continue;
        }

        // Insert options
        const optionsToInsert = suggestion.options.map((option: string) => ({
          survey_id: survey.id,
          option_text: option
        }));

        const { error: optionsError } = await supabase
          .from('survey_options')
          .insert(optionsToInsert);

        if (optionsError) {
          console.error("Error creating options:", optionsError);
        } else {
          publishedSurveys.push(survey.id);
          console.log(`Published survey: ${suggestion.title}`);
        }
      } catch (err) {
        console.error("Error publishing suggestion:", err);
      }
    }

    console.log(`Auto-publish complete. Published ${publishedSurveys.length} surveys.`);

    return new Response(JSON.stringify({ 
      success: true, 
      publishedCount: publishedSurveys.length,
      surveyIds: publishedSurveys
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in auto-publish-surveys:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
