'use strict';

const net = require('net');
//const net = require('tls');
const crypto = require('crypto');
const httpHeaders = require('http-headers');
const sender = require('./websocket/sender');
const frame = require('./websocket/frame');

const client = net.connect({
    host: 'localhost',
    port: 8080,
    rejectUnauthorized: false
}, () => {
    const key = genKey();
    let data = '';
    let parse = waitHttpHeader;

    function waitHttpHeader(buffer) {
        data += buffer.toString('utf-8');
        const endOfHeader = data.indexOf('\r\n\r\n');
        if (endOfHeader === -1) {
            return;
        }

        const headerStr = data.slice(0, endOfHeader);
        if (!isValidNegotiationHeader(headerStr, key)) {
            throw new Error('Websocket Negotiation failed');
        }

        parse = waitWebSocketFrame;

        var x = setInterval(() => {
            client.write(sender.toPingFrame('ping pong'));
        }, 1000);


        client.write(sender.toStartFrame('nyan '));
        client.write(sender.toContinualFrame('wang '));
        client.write(sender.toEndFrame('wang nyan'));

        setTimeout(() => {
            clearInterval(x);
            client.write(sender.toCloseFrame());
        }, 5000);

        let type;

        function waitWebSocketFrame(buffer) {
            const f = new frame.Frame(buffer);
            const opcode = f.getOpcode();

            switch (opcode) {
            case frame.OPCODE.PING:
            case frame.OPCODE.PONG:
                console.log(f.getPayloadAsText());
                break;
            case frame.OPCODE.CONTINATION:
                if (type === frame.OPCODE.TEXT) {
                    console.log(f.getPayloadAsText());
                } else if (type === frame.OPCODE.BINARY) {
                    console.log(f.getPayloadAsBuffer().toString('hex'));
                }
                break;
            case frame.OPCODE.TEXT:
                console.log(f.getPayloadAsText());
                type = frame.OPCODE.TEXT;
                break;
            case frame.OPCODE.BINARY:
                console.log(f.getPayloadAsBuffer().toString('hex'));
                type = frame.OPCODE.BINARY;
                break;
            case frame.OPCODE.CLOSE:
                console.log('receive close response');
                clearInterval(x);
                break;
            default:
                console.log(`unknown opcode ${opcode}` );
                break;
            }
        }
    }



    client.on('data', (message) => {
        parse(message);
    });
    client.on('error', (err) => {
        console.error(err);
        client.end();
    });

    client.write('GET / HTTP/1.1\n');
    client.write('Host: localhost\n');
    client.write('Upgrade: websocket\n');
    client.write('Connection: Upgrade\n');
    client.write('Sec-Websocket-Key: ' + key + '\n');
    client.write('Sec-Websocket-Version: 13\n');
    client.write('\n');
});

function longText() {
    return ''.padEnd(0x4000, '0123456789abcdef');
}

function isValidNegotiationHeader(httpHeaderStr, key) {
    const httpHeader = httpHeaders(httpHeaderStr);
    console.error(httpHeader);

    if (httpHeader.statusCode !== 101) { // switch protocols
        return false;
    }
    if (httpHeader.headers.connection.toLowerCase() !== 'upgrade') {
        return false;
    }
    if (httpHeader.headers.upgrade.toLowerCase() !== 'websocket') {
        return false;
    }

    const sha1 = crypto.createHash('sha1');
    sha1.update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
    const b = sha1.digest();
    const accept = b.toString('base64');

    console.error(accept);

    if (accept !== httpHeader.headers['sec-websocket-accept']) {
        return false;
    }

    return true;
}

function genKey() {
    const buf = Buffer.alloc(4);
    for (let i = 0; i < 4; i++) {
        buf.writeUInt8(Math.floor((Math.random() * 256)) ,i);
    }
    return buf.toString('base64');
}

