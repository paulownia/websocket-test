'use strict';

const {Client} = require('./lib/websocket/client');
const sender = require('./lib/websocket/sender');

const client = new Client("ws://localhost:8080/");

client.on('open', () => {
    console.log('open');
    client.write(sender.toFrame('nyan'));

    setTimeout(() => {
        client.write(sender.toCloseFrame());
    }, 5000);
});

client.on('error', (err) => {
    console.log('error', err);
    client.end();
});

client.on('data', (data) => {
    console.log(data);
});

client.on('close', () => {
    console.log('close');
});

