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

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});



// Listening to all incoming messages
client.on('message_create', message => {
	console.log(message.body);
});

client.on('message_create', message => {
	if (message.body === 'ping') {
		// reply back "pong" directly to the message
		message.reply('pong');
	}
});

client.initialize();
