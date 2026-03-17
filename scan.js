// Vercel Serverless Function: POST /api/scan
// Body: { image: "data:image/jpeg;base64,..." }
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { image } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: "Missing image" });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!openaiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error("ENV_MISSING", { openaiKey: !!openaiKey, supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey });
    return res.status(500).json({ error: "Server configuration missing. Contact admin." });
  }

  try {
    // 1) Ask OpenAI Vision for the material label
    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 50,
        messages: [
          {
            role: "system",
            content:
              'Classify the fashion material. Allowed labels: "zip", "trim", "feather", "bead", "button", or the closest match. Respond ONLY as JSON: {"label":"label"}.'
          },
          {
            role: "user",
            content: [
              { type: "text", text: "What material is this?" },
              { type: "image_url", image_url: { url: image, detail: "low" } }
            ]
          }
        ]
      })
    });

    if (!ai.ok) {
      const err = await ai.text();
      console.error("OPENAI_ERROR", err);
      return res.status(ai.status).json({ error: "Vision scan failed. Please retry." });
    }

    const aiJson = await ai.json();
    const content = aiJson.choices?.[0]?.message?.content || "";
    let label;
    try {
      label = JSON.parse(content).label;
    } catch {
      label = content.split(/\s|,/)[0];
    }

    if (!label) return res.status(422).json({ error: "No label returned" });
    const normalized = label.toLowerCase().trim();

    // 2) Look up material in Supabase
    const lookup = await fetch(
      `${supabaseUrl}/rest/v1/materials?select=name,price,image_url&name=eq.${encodeURIComponent(normalized)}`,
      {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`
        }
      }
    );

    if (!lookup.ok) {
      const err = await lookup.text();
      console.error("SUPABASE_LOOKUP_ERROR", err);
      return res.status(lookup.status).json({ error: "Database lookup failed." });
    }

    const rows = await lookup.json();
    if (rows.length > 0) {
      const material = rows[0];
      return res.status(200).json({ label: normalized, price: material.price, image_url: material.image_url });
    }

    // Not found
    return res.status(200).json({ label: normalized, status: "not_found" });
  } catch (error) {
    console.error("SCAN_ROUTE_ERROR", error);
    return res.status(500).json({ error: "Server error during scan." });
  }
}

// Ensure this runs as a Node (not Edge) function on Vercel
export const config = {
  runtime: "nodejs18.x",
};
