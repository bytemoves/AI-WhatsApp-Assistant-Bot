const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require("fs");
require("dotenv").config();

const promptText = fs.readFileSync("prompt.txt", "utf-8");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;


if (!GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY is missing. Please set it in your .env file.");
    process.exit(1); // Exit if API key is missing
}

// initialize client i have stored the session locally you can store them anywhere
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: 'session' })
});

/// to do  save this in mongodb.. save chat history
const greetedUsers = new Set();
const userMessageCounts = new Map();


client.on('ready', () => {
    console.log('Client is ready!');
});

//  QR code generated for login
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

//  get response from Gemini API
async function getGeminiResponse(messageText) {
    try {
        const response = await axios.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
            {
                contents: [
                    {
                        parts: [
                            {
                                text: promptText + "\n" + messageText,
                            },
                        ],
                    },
                ],
            },
            {
                params: { key: GEMINI_API_KEY },
                headers: { "Content-Type": "application/json" },
            }
        );

        // Safely extract the AI response
        const candidate = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
            return candidate.trim();
        } else {
            console.error("Unexpected Gemini API response:", response.data);
            return "I was unable to generate a response. Please try again.";
        }
    } catch (error) {
        console.error("Gemini API error:", error.response?.data || error.message);
        return "An error occurred while obtaining a response from the AI.";
    }
}

// Event: Handle incoming messages
client.on("message", async (message) => {
    const user = message.from;
    const messageText = message.body.toLowerCase().trim();

    // Ignore messages sent by the bot itself
    if (message.author === client.info.wid._serialized) {
        return;
    }

    // Ignore group messages
    if (message.isGroup) {
        return; // No need to log every ignored group message
    }

    // Handle greeting message
    if (messageText === "hey" && !greetedUsers.has(user)) {
        try {
            await message.reply("Hey too! How can I help you?");
            greetedUsers.add(user);
        } catch (error) {
            console.error("Error sending greeting:", error);
        }
        return;
    }

    // Handle farewell message
    if (messageText === "adios") {
        try {
            await message.reply("Fugosto!");
        } catch (error) {
            console.error("Error sending farewell:", error);
        }
        return;
    }

    // track user message count
    let userData = userMessageCounts.get(user);
    const now = Date.now();
    if (!userData) {
        userData = { count: 1, firstMessageTime: now };
    } else {
        const timeElapsed = now - userData.firstMessageTime;
        if (timeElapsed > 3600000) { // Reset after 1 hour
            userData.count = 1;
            userData.firstMessageTime = now;
        } else {
            userData.count += 1;
        }
    }
// should not log this on the terminal
    console.log("userData: ", userData);
    userMessageCounts.set(user, userData);

    // message limintig configured in the env
    const hourlyLimit = parseInt(process.env.HOURLY_MESSAGE_LIMIT || 100); // Default to 15
    if (userData.count > hourlyLimit) {
        try {
            await message.reply(`Sorry, you have reached the hourly question limit of ${hourlyLimit}.`);
        } catch (error) {
            console.error("Error sending limit message:", error);
        }
        return;
    }

    // Process message with Gemini API
    try {
        const aiResponse = await getGeminiResponse(message.body);
        try {
            await message.reply(aiResponse);
        } catch (replyError) {
            console.error("Failed to send reply:", replyError);
            await message.reply("Sorry, there was an error processing your message.");
        }
    } catch (error) {
        console.error("Error processing message:", error);
        try {
            await message.reply("Sorry, there was an error processing your message.");
        } catch (replyError) {
            console.error("Failed to send error reply:", replyError);
        }
    }
});

// Graceful shutdown handler
process.on("SIGINT", async () => {
    console.log("Shutting .....");
    // Save data to files (optional, depending on persistence strategy)
    console.log("Data saved. Exiting...");
    process.exit(0);
});

// Start the bot
client.initialize();