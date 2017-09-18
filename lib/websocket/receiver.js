'use strict';

const { Transform } = require('stream');

const TEXT_TYPE = 1;
const BINARY_TYPE = 2;

class Receiver extends Transform {
    constructor(options) {
        super(options);
        this.data = Buffer.alloc(Math.pow(2, 16) - 1);
        this.length = 0;
        this.pos = 0;
        this.payloads = [];
        this.type = 0;
    }

    _addBuffer(buf) {
        if (this.data.length - this.length < buf.length) {
            const newData = Buffer.alloc(this.data.length * 2);
            this.length = this.data.length;
            this.data.copy(newData);
            this.data = newData;
        }

        buf.copy(this.data, this.length);
        this.length += buf.length;
    }

    _getFrameInfo() {
        const fin = this.data.readUInt8(0) & 0x80;

        const dataType = this.

        const masked = this.data.readUInt8(1) & 0x80;

        const maskingKeyLength = isMasked ? 4 : 0;

        const length = this.data.readUInt8(1) & 0x7f;

        const dataType = this.data.readUInt8(1)


        if (length === 126) {
            return {
                payloadLength: this.data.readUInt16BE(2),
                payloadOffset: 4 + maskingKeyLength,
                maskingKey: isMasked ?  this.data.readUInt32BE(4) : null,
                masked
            };
        } else if (length === 127) {
            return {
                payloadLength: this.data.readDoubleBE(2),
                payloadOffset: 10 + maskingKeyLength,
                maskingKey: isMasked ?  this.data.readUInt32BE(10) : null,
                masked
            };
        } else {
            return {
                payloadLength: length,
                payloadOffset: 2 + maskingKeyLength,
                maskingKey: isMasked ?  this.data.readUInt32BE(2) : null,
                masked
            };
        }
    }

    _transform(data, encoding, callback) {
        this._addBuffer(data);
        if (this.pos !== 0) {
            return;
        }

        const frameInfo = this._getFrameInfo();
        if (frameInfo.payloadLength >= 4294967296) {
            callback(new Error('payload too large'));
            return;
        }

        if (this.length >= frameInfo.payloadLength + frameInfo.payloadOffset) {
            const payload = Buffer.from(this.data.slice(frameInfo.payloadOffset, frameInfo.payloadLength));
            this.payloads.push(payload);

            const remain = this.data.slice(frameInfo.payloadLength + frameInfo.payloadOffset);
            this.length = remain.length;
            this.pos = 0;
            remain.copy(this.data);

            if (frameInfo.isFin) {
                callback(null, Buffer.concat(this.payloads));
                return;
            }
        }
    }

    _flash() {

    }

    _final() {

    }
}
