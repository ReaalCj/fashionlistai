// Vercel serverless function: POST /api/scan
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { image } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: "Missing image" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY not set" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 50,
        messages: [
          {
            role: "system",
            content:
              'Classify the fashion material in the photo. Allowed labels: "zip", "trim", "feather", "bead", "button". Respond ONLY as JSON: {"label":"label"}'
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

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    let label;
    try {
      const parsed = JSON.parse(content);
      label = parsed.label;
    } catch (err) {
      label = content.split(/\s|,/)[0];
    }

    if (!label) {
      return res.status(422).json({ error: "No label returned" });
    }

    return res.status(200).json({ label });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
