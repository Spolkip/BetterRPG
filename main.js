// main.js
require('dotenv').config();
const RPGClient = require('./src/client');
const client = new RPGClient();

client.login(process.env.DISCORD_TOKEN);