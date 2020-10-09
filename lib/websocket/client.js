'use strict'

const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const {URL} = require('url');
const {EventEmitter} = require('events');
const httpHeaders = require('http-headers');

const frame = require('./frame');

class Client extends EventEmitter{
    constructor(url) {
        super();

        this.url = new URL(url);

        const key = genKey();
        const Socket = typeof(url) === 'string' &&  url.startsWith('wss://') ? tls.Socket : net.Socket;

        this.socket = new Socket();

        this.socket.on('data', (buffer) => {
            try {
                const end = parse(buffer);
                if (!end) {
                    return;
                }
            } catch(e) {
                this.emit('error', e);
                return;
            }

            this.socket.removeAllListeners('data');

            this.socket.on('data', (buffer) => {
                this._wait(buffer);
            });

            this.emit('open');
        });

        this.socket.on('error', (error) => {
            this.emit('error', error)
        });

        this.socket.connect({ port: this.url.port, host: this.url.hostname }, () => {
            const client = this.socket;
            client.write('GET / HTTP/1.1\n');
            client.write('Host: localhost\n');
            client.write('Upgrade: websocket\n');
            client.write('Connection: Upgrade\n');
            client.write('Sec-Websocket-Key: ' + key + '\n');
            client.write('Sec-Websocket-Version: 13\n');
            client.write('\n');
        });


        let data = '';
        function parse(buffer) {
            data += buffer.toString('utf-8');
            const endOfHeader = data.indexOf('\r\n\r\n');
            if (endOfHeader === -1) {
                return false;
            }

            const headerStr = data.slice(0, endOfHeader);
            if (!isValidNegotiationHeader(headerStr, key)) {
                throw new Error('Websocket Negotiation failed');
            }

            return true;
        }
    }

    _wait(buffer) {
        const f = new frame.Frame(buffer);
        const opcode = f.getOpcode();
        switch (opcode) {
        case frame.OPCODE.PING:
            this.emit('ping', f.getPayloadAsBuffer());
            break;
        case frame.OPCODE.PONG:
            this.emit('pong', f.getPayloadAsBuffer());
            break;
        case frame.OPCODE.CONTINATION:
            this.wsData = Buffer.concat([this.wsData, f.getPayloadAsBuffer()]);
            break;
        case frame.OPCODE.TEXT:
        case frame.OPCODE.BINARY:
            this.wsData = f.getPayloadAsBuffer();
            this.wsType = opcode;
            break;
        case frame.OPCODE.CLOSE:
            this.emit('close', f);
            break;
        default:
            this.emit('error', new Error('Unknown websocket opcode:' + opcode ));
            break;
        }

        if (f.isFin() && this.wsData) {
            if (this.wsType === frame.OPCODE.TEXT) {
                this.emit('data', this.wsData.toString('utf8'));
            } else {
                this.emit('data', this.wsData);
            }
            this.wsData = null;
            this.wsType = null;
        }
    }

    write(data) {
        this.socket.write(data);
    }

    end() {
        this.socket.end();
    }
}

function genKey() {
    const buf = Buffer.alloc(4);
    for (let i = 0; i < 4; i++) {
        buf.writeUInt8(Math.floor((Math.random() * 256)) ,i);
    }
    return buf.toString('base64');
}

function isValidNegotiationHeader(httpHeaderStr, key) {
    const httpHeader = httpHeaders(httpHeaderStr);

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

    if (accept !== httpHeader.headers['sec-websocket-accept']) {
        return false;
    }

    return true;
}

exports.Client = Client;
