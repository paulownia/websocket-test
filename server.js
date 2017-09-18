'use strict';

const http = require('http');
const ws = require('ws');
const express = require('express');

const app = express();
const httpServer = http.createServer(app);
const wsServer = new ws.Server({server: httpServer});

app.use(express.static('public'));

wsServer.on('connection', (wsClient) => {
    console.error('ws: open');

    wsClient.on('message', (data) => {
        console.error('ws: message:', data);
        wsClient.send(data);
    });
    wsClient.on('error', (err) => {
        console.error(`ws: error: ${err}`);
        wsClient.terminate();
    });
    wsClient.on('close', () => {
        console.error('ws: close');
    });
});

httpServer.listen(8080, () => {
    console.error('start http server');
});
