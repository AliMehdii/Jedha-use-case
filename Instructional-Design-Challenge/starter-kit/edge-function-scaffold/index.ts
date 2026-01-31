// ============================================
// CRM Agent - Edge Function Entry Point
// ============================================
// This is the main file that Supabase Edge Functions will run.
// It receives requests from your Lovable frontend and routes them to the agent.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// We'll import our agent here once we build it
// import { runAgent } from "./agent.ts";

// CORS headers - needed so your frontend can talk to this function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the request body
    const { message, leadId } = await req.json();

    // Validate input
    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'message' field" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // TODO: This is where you'll call your agent
    // For now, we just echo back the message
    const response = {
      success: true,
      message: `Agent received: "${message}"`,
      // Once agent is built:
      // result: await runAgent({ message, leadId, supabase })
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    // Don't expose internal errors to clients
    console.error("Agent error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Something went wrong. Check the Edge Function logs for details." 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
