
const fs = require('fs');

async function testModel(modelName) {
    try {
        // Load env manually
        let apiKey = process.env.APIYI_API_KEY;
        if (!apiKey) {
            try {
                const env = fs.readFileSync('.env', 'utf8');
                const match = env.match(/APIYI_API_KEY=(.+)/);
                if (match) apiKey = match[1].trim();
            } catch (e) {}
        }
        
        if (!apiKey) {
            console.log("No API Key");
            return;
        }

        console.log(`Testing model: ${modelName}...`);
        
        const data = JSON.stringify({
            model: modelName,
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 5
        });

        const url = "https://api.apiyi.com/v1/chat/completions";
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: data
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log(`[SUCCESS] ${modelName}:`, result.choices?.[0]?.message?.content || "No content");
            return true;
        } else {
            console.log(`[FAILED] ${modelName}:`, result.error?.message || JSON.stringify(result));
            return false;
        }

    } catch (e) {
        console.log(`[ERROR] ${modelName}:`, e.message);
        return false;
    }
}

async function run() {
    const models = [
        "gpt-4o-mini",
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash", 
        "claude-3-haiku-20240307",
        "deepseek-reasoner"
    ];

    for (const m of models) {
        await testModel(m);
    }
}

run();
