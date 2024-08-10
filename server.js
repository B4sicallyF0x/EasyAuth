require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 80;

const token = process.env.TELEGRAM_BOT_TOKEN;
const authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);

const bot = new TelegramBot(token, { polling: true });

const ipFilePath = path.join(__dirname, 'ips.json');

// Load IPs from file with error handling
const loadIPs = () => {
    try {
        if (fs.existsSync(ipFilePath)) {
            const data = fs.readFileSync(ipFilePath);
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error reading IPs file:', error);
        return [];
    }
};

// Save IPs to file with error handling
const saveIPs = (ips) => {
    try {
        fs.writeFileSync(ipFilePath, JSON.stringify(ips, null, 2));
    } catch (error) {
        console.error('Error writing IPs file:', error);
    }
};

let ipList = loadIPs();

const generateIPKeyboard = () => {
    return ipList.map((ip) => ([{
        text: ip,
        callback_data: `ip_${ip}`
    }]));
};

const isInternalIP = (ip) => {
    return /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(ip);
};

const requestIP = async (chatId, attemptsLeft = 3) => {
    if (attemptsLeft === 0) {
        bot.sendMessage(chatId, "Sorry, I can't understand you.");
        return;
    }

    bot.sendMessage(chatId, 'Please send the IP you want to add.');
    
    bot.once('message', async (msg) => {
        const ip = msg.text.trim();
        const ipRegex = (await import('ip-regex')).default;

        if (ip === '127.0.0.1') {
            bot.sendMessage(chatId, "The IP 127.0.0.1 is a local IP and cannot be added.");
            return;
        }

        if (ipRegex({ exact: true }).test(ip)) {
            if (isInternalIP(ip)) {
                bot.sendMessage(chatId, `The IP you specified (${ip}) belongs to an internal network. Are you sure?`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Yes, add it', callback_data: `confirm_add_${ip}` }],
                            [{ text: 'No, cancel', callback_data: 'do_nothing' }]
                        ]
                    }
                });
            } else {
                if (!ipList.includes(ip)) {
                    ipList.push(ip);
                    saveIPs(ipList);
                    bot.sendMessage(chatId, `IP ${ip} added.`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Add IP', callback_data: 'add_ip' }],
                                [{ text: 'IP List', callback_data: 'ip_list' }]
                            ]
                        }
                    });
                } else {
                    bot.sendMessage(chatId, `The IP ${ip} is already in the list.`);
                }
            }
        } else {
            bot.sendMessage(chatId, `The IP ${ip} is not valid. Please try again.`);
            requestIP(chatId, attemptsLeft - 1);
        }
    });
};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    if (chatId !== authorizedUserId) {
        bot.sendMessage(chatId, 'Unauthorized access.');
        return;
    }

    bot.sendMessage(chatId, 'Welcome to EasyAuth. Please select an option below.', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Add IP', callback_data: 'add_ip' }],
                [{ text: 'IP List', callback_data: 'ip_list' }]
            ]
        }
    });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;

    if (chatId !== authorizedUserId) {
        bot.sendMessage(chatId, 'Unauthorized access.');
        return;
    }

    const action = query.data;

    if (action === 'add_ip') {
        requestIP(chatId);
    } else if (action === 'ip_list') {
        if (ipList.length === 0) {
            bot.sendMessage(chatId, 'No IPs in the list.');
        } else {
            bot.sendMessage(chatId, 'Here is the list of IPs.', {
                reply_markup: {
                    inline_keyboard: generateIPKeyboard()
                }
            });
        }
    } else if (action.startsWith('ip_')) {
        const ip = action.split('_')[1];
        bot.sendMessage(chatId, `What do you want to do with IP ${ip}?`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Delete IP', callback_data: `delete_${ip}` }],
                    [{ text: 'Do nothing', callback_data: 'do_nothing' }]
                ]
            }
        });
    } else if (action.startsWith('delete_')) {
        const ipToDelete = action.split('_')[1];
        ipList = ipList.filter(ip => ip !== ipToDelete);
        saveIPs(ipList);
        bot.sendMessage(chatId, `IP ${ipToDelete} deleted.`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Add IP', callback_data: 'add_ip' }],
                    [{ text: 'IP List', callback_data: 'ip_list' }]
                ]
            }
        });
    } else if (action.startsWith('confirm_add_')) {
        const ipToAdd = action.split('_')[2];
        if (!ipList.includes(ipToAdd)) {
            ipList.push(ipToAdd);
            saveIPs(ipList);
            bot.sendMessage(chatId, `IP ${ipToAdd} added.`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Add IP', callback_data: 'add_ip' }],
                        [{ text: 'IP List', callback_data: 'ip_list' }]
                    ]
                }
            });
        } else {
            bot.sendMessage(chatId, `The IP ${ipToAdd} is already in the list.`);
        }
    } else if (action === 'do_nothing') {
        bot.sendMessage(chatId, 'No action taken.', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Add IP', callback_data: 'add_ip' }],
                    [{ text: 'IP List', callback_data: 'ip_list' }]
                ]
            }
        });
    }
});

app.get('/', (req, res) => {
    res.send(ipList.join('\n'));
});

app.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
});
