'use strict';

const {Client} = require('./lib/websocket/client');
const sender = require('./lib/websocket/sender');

const client = new Client("ws://localhost:8080/");

const timer = [];

client.on('open', () => {
    console.log('open');
    setTimeout(() => {
        client.write(sender.toCloseFrame());
    }, 10000);

    timer.push(setInterval(() => {
        client.write(sender.toFrame("nyan"));
    }, 2000));

    timer.push(setInterval(() => {
        client.write(sender.toPingFrame("wang"));
    }, 1000));
});

client.on('error', (err) => {
    console.log('error', err);
    client.end();
});

client.on('data', (data) => {
    console.log('message', data);
});

client.on('close', () => {
    timer.forEach((t) => { clearInterval(t) });
    console.log('close');
});

client.on('ping', (buf) => {
    console.log('ping');
    client.write(sender.toPongFrame(buf))
});

client.on('pong', (buf) => {
    console.log('pong', buf.toString('utf8'));
});
