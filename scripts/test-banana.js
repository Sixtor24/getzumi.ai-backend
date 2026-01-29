
const fs = require('fs');

async function testModel(modelName) {
    try {
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
            messages: [{ role: "user", content: "Say hello" }],
            max_tokens: 10
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
        } else {
            console.log(`[FAILED] ${modelName}:`, result.error?.message || JSON.stringify(result));
        }

    } catch (e) {
        console.log(`[ERROR] ${modelName}:`, e.message);
    }
}

async function run() {
    await testModel("nano-banana");
    await testModel("nano-banana-pro");
}

run();
