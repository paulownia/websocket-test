'use strict';

const common = require('./common');

/**
 * テキストをWebSocketフレームに変換
 *
 * @param {string|buffer} data データ
 * @return {buffer} フレーム
 *
 */
exports.toFrame = function(data) {
    let type;
    let payload;

    if (typeof data === 'string') {
        type = 0x01;   // TEXT
        payload = Buffer.from(data, 'utf8');
    } else if (data instanceof Buffer) {
        type = 0x02;   // BINARY
        payload = data;
    } else {
        throw new Error('Unsupported data type');
    }

    const payloadLength = payload.length;
    if (payloadLength > 4294967295) {
        // 一旦32bitに制限する
        throw new Error('payload too large');
    }

    let frame;
    let extended = 0;

    // set mask(higher 1 bit) and payload length(lower 7 bits), enxtended 16/64 bits
    if (payloadLength <= 125) {
        frame = new Buffer(6 + payloadLength);
        frame.writeUInt8(0x80 | payloadLength, 1);

    } else if (payloadLength <= 0xffff) {
        frame = new Buffer(8 + payloadLength);
        frame.writeUInt8(0xfe, 1); // 0xfe = 0x80 | 126;
        frame.writeUInt16BE(payloadLength, 2);
        extended = 2;

    } else {
        frame = new Buffer(14 + payloadLength);
        frame.writeUInt8(0xff, 1); // 0xff = 0x80 | 127;
        frame.writeUInt32BE(0, 2);
        frame.writeUInt32BE(payloadLength, 6);
        extended = 8;
    }

    // fin 0x80 | opcode data type
    frame.writeUInt8(0x80 | type, 0);

    const maskingKey = common.createMaskingKey();

    // Masking Key
    maskingKey.copy(frame, 2 + extended);

    // Masking
    const maskedPayload = common.applyMasking(payload, maskingKey);

    // Payload Data
    maskedPayload.copy(frame, 6 + extended);

    return frame;
};

exports.toStartFrame = function(text) {
    const frame = exports.toFrame(text);
    frame.writeUInt8(frame.readUInt8(0) & 0x7f, 0);    // fill Fin 0
    return frame;
};

exports.toContinualFrame = function(text) {
    const frame = exports.toFrame(text);
    frame.writeUInt8(0x00, 0);    // set Fin to 0, and Opcode to 0x0
    return frame;
};

exports.toEndFrame = function(text) {
    const frame = exports.toFrame(text);
    frame.writeUInt8(0x80, 0);   // set Fin to 1, and Opcode to 0x0
    return frame;
};

exports.toCloseFrame = function() {
    const status = Buffer.alloc(2);
    status.writeUInt16BE(1000);
    const frame = exports.toFrame(status);
    frame.writeUInt8(0x88, 0);   // set Fin to 1, and Opcode 0x8
    return frame;
};

exports.toPingFrame = function(text) {
    const frame = exports.toFrame(text);
    frame.writeUInt8(0x89, 0);   // set Fin to 1, and Opcode 0x9
    return frame;
};

exports.toPongFrame = function(text) {
    // ボディデータはpingと同じものにしなければならない
    const frame = exports.toFrame(text);
    frame.writeUInt8(0x89, 0);   // set Fin to 1, and Opcode 0x9
    return frame;
};
