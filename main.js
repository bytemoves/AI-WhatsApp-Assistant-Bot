const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: 'session'
    })
});

const greetedUsers = new Set();
const userMessageCounts = new Map();
client.on('ready', () => {
    console.log('Client is ready!');
});



client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});



async function getGeminiResponse(messageText) {

    try {
        const response = await axios.post (
            "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent",
            {
                contents:[
                    {
                        parts:[
                            {
                               text:
                               "" + messageText,
                            },
                        ],
                    },
                ],
            },
            {
                params : {key: GEMINI_API_KEY},
                headers : {"Content-Type":"application/json"}

            }

        );

        return (
            response.data?.response.data?.candidates?.[0]?.content?.parts?.[0]?.text.trim() ||
            "some text here"
        );
    } catch (error){
        console.log(
            "Gemini api error:",error.response?.data || error.message
        );

        return "something"
    }
    
}

// event handler for oncoming messages

client.on("message",async(message)=> {

    const user = message.from;
    const messageText = message.body.toLowerCase().trim();

    if (messageText === "hey" && !greetedUsers.has(users)) {
        await message.reply("hey too how can i help you");
        greetedUsers.add(user);
        return;
    }

    if (messageText === "adios" ){
        await message.reply("fugosto");
        return;
    }

    let userData = userMessageCounts.get(user);
  const now = Date.now();
  if (!userData) {
    userData = { count: 1, firstMessageTime: now };
  } else {
    const timeElapsed = now - userData.firstMessageTime;
    if (timeElapsed > 3600000) {
      userData.count = 1;
      userData.firstMessageTime = now;
    } else {
      userData.count += 1;
    }
  }

  console.log("userData: ", userData);
  userMessageCounts.set(user, userData);

  if (userData.count > 15) {
    await message.reply(
      "Lo siento, alcanzaste el límite de preguntas por hora."
    );
    return;
  }

  ///process any message with gemini

  try {
    const aiResponse = await getGeminiResponse(message.body);
    await message.reply(aiResponse);
  } catch (error) {
    console.error("Error al procesar mensaje:", error);
    await message.reply("Lo siento, hubo un error al procesar tu mensaje.");
  }
});
// // Listening to all incoming messages
// client.on('message_create', message => {
// 	console.log(message.body);
// });

// client.on('message_create', message => {
// 	if (message.body === 'ping') {
// 		// reply back "pong" directly to the message
// 		message.reply('pong');
// 	}
// });

client.initialize();
