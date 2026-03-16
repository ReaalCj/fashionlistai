// Vercel Serverless Function: POST /api/saveMaterial
// Body: { name: "material", price: number, image?: "data:image/jpeg;base64,..." }
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, price, image } = req.body || {};
  if (!name || price === undefined) {
    return res.status(400).json({ error: "Missing name or price" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Server env vars not set" });
  }

  let imageUrl = null;

  // Optional: upload image to storage if provided
  if (image) {
    try {
      const base64 = image.split(",")[1];
      const buffer = Buffer.from(base64, "base64");
      const fileName = `${crypto.randomUUID()}.jpg`;

      const upload = await fetch(`${supabaseUrl}/storage/v1/object/materials/${fileName}`, {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`
        },
        body: buffer
      });

      if (upload.ok) {
        imageUrl = `${supabaseUrl}/storage/v1/object/public/materials/${fileName}`;
      }
    } catch (err) {
      console.warn("Image upload skipped", err);
    }
  }

  try {
    const insert = await fetch(`${supabaseUrl}/rest/v1/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        name: name.toLowerCase().trim(),
        price,
        image_url: imageUrl
      })
    });

    if (!insert.ok) {
      const err = await insert.text();
      return res.status(insert.status).json({ error: err });
    }

    const [row] = await insert.json();
    return res.status(200).json({ material: row });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
}

export const config = {
  runtime: "nodejs18.x",
};
