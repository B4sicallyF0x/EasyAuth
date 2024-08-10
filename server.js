const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const port = process.env.PORT || 80;

dotenv.config();


const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });


const AUTHORIZED_USER_ID = parseInt(process.env.AUTHORIZED_USER_ID, 10);

const DOMAIN = process.env.DOMAIN;


const NOIP_UPDATE_URL = 'https://dynupdate.no-ip.com/nic/update';


bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId === AUTHORIZED_USER_ID) {
        bot.sendMessage(chatId, 'Welcome to EasyAuth. Please select an option below.', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'View current IP', callback_data: 'view_ip' }],
                    [{ text: 'Change IP', callback_data: 'change_ip' }]
                ]
            }
        });
    } else {
        bot.sendMessage(chatId, 'Unauthorized access.');
    }
});


bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;

    if (chatId !== AUTHORIZED_USER_ID) return;

    if (action === 'view_ip') {
        try {
            const response = await axios.get(`http://ip-api.com/json/${DOMAIN}`);
            if (response.data.status === 'fail') {
                bot.sendMessage(chatId, 'Error fetching IP address.');
            } else {
                const ip = response.data.query;
                bot.sendMessage(chatId, `Current IP is: ${ip}`);
            }
        } catch (error) {
            bot.sendMessage(chatId, 'Error fetching IP address.');
        }
    } else if (action === 'change_ip') {
        bot.sendMessage(chatId, 'Please enter the new IP address:');
        bot.once('message', async (msg) => {
            const newIp = msg.text;
            if (validateIP(newIp)) {
                try {
                    const response = await axios.get(NOIP_UPDATE_URL, {
                        params: {
                            hostname: DOMAIN,
                            myip: newIp
                        },
                        auth: {
                            username: process.env.NOIP_USERNAME,
                            password: process.env.NOIP_PASSWORD
                        }
                    });
                    bot.sendMessage(chatId, `IP updated successfully: ${response.data}`);
                } catch (error) {
                    bot.sendMessage(chatId, 'Error updating IP.');
                }
            } else {
                bot.sendMessage(chatId, 'Invalid IP address. Please try again.');
            }
        });
    }
});


function validateIP(ip) {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}
