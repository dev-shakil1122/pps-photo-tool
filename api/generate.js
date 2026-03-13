export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // Check if the API key is configured in Vercel Environment Variables
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
        return res.status(500).json({
            error: {
                message: "Server configuration error: GEMINI_API_KEY is not set in Vercel Environment Variables."
            }
        });
    }

    try {
        const payload = req.body;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Forward status codes from Google
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.status(200).json(data);

    } catch (error) {
        console.error("Error proxying to Gemini API:", error);
        res.status(500).json({
            error: {
                message: "Internal Server Error communicating with the AI service."
            }
        });
    }
}
