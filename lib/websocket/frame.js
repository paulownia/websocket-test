/*jshint maxstatements:256 */
/*
// 最初のバイトの上位4ビットのデータ
// コレ以外だったらエラーなので切断されるらしい
var FRAGMENT = {
    CONTINUOUS: 0x0,
    LAST: 0x8,
};

*/

// オペコード、最初のバイトの下位4ビット
exports.OPCODE = {
    CONTINUATION: 0x0,
    TEXT: 0x1,
    BINARY: 0x2,
    CLOSE: 0x8,
    PING: 0x9,
    PONG: 0xA,
};

/**
 * マスク用のキーを作成します
 * @return {Buffer}
 */
function createMaskingKey() {
    var buf = new Buffer(4);
    for (var i = 0; i < 4; i++) {
        buf.writeUInt8(Math.floor(Math.random() * 256), i);
    }
    return buf;
}

/**
 * マスキング、アンマスキング処理を行います
 *
 * @param {Buffer} payload - ペイロード
 * @param {Buffer} key - 任意の32bitの値、長さ4のbuffer
 * @return {Buffer} マスク・アンマスクされたペイロード
 */
function transformMasking(payload, key) {
    if (key.length !== 4) {
        throw new Error('key is not 32bit');
    }

    var transformedData = new Buffer(payload.length);
    for (var i = 0; i < payload.length; i++) {
        var j = i % 4;
        transformedData[i] = payload[i] ^ key[j];
    }

    return transformedData;
}

/**
 * フレームオブジェクト
 *
 * @param {Buffer|Array|string} - バッファ、またはUTF8テキスト、またはバッファの配列
 */
function Frame(data) {
    if (Buffer.isBuffer(data)) {
        this.frame = data;
    } else if (Array.isArray(data)) {
        this.frame = new Buffer(data);
    } else {
        this.frame = new Buffer(data, 'utf8');
    }
}

/**
 * フレームオブジェクトをクローンする。
 * 内部に保持しているバッファーは複製される
 *
 * @return クローン
 */
Frame.prototype.clone = function() {
    return new Frame(Buffer.from(this.frame));
};

/**
 * オペコードを取得
 * @return {boolean}:
 */
Frame.prototype.getOpcode = function() {
    return (this.frame[0] & 0xf);
};

/**
 * 最後のフレームデータであるかどうか調べる
 */
Frame.prototype.isFin = function() {
    return (this.frame[0] & 0x80) === 0x80;
};

/**
 * ペイロードをテキストとして読み込む
 *
 * TODO 仕様上は(64bit uintの最大値)byteまでペイロードに乗せられるようだが
 * 52bitで表現できる長さより大きなペイロードが入っていたらread失敗する
 * 実際そんな巨大なペイロードが含まれる事はないと思うが…
 */
Frame.prototype.getPayloadAsText = function() {
    return this.getPayloadAsBuffer().toString('utf8');
};

Frame.prototype.getPayloadAsBuffer = function() {
    var offset = 2;

    var length = this.getPayloadLength();
    if (length > 65535) {
        offset += 8;
    } else if (length > 125) {
        offset += 2;
    }

    var masked = this.isMasked();
    if (masked) {
        offset += 4;
    }

    var payload = this.frame.slice(offset);

    if (masked) {
        var key = this.getMaskingKey();
        return transformMasking(payload, key);
    } else {
        return payload;
    }
};

Frame.prototype.getMaskingKey = function() {
    var length = this.frame[1] & 0x7f;
    if (length === 127) {  // 64bitのextendあり
        // extended payload length あり、10byte目から4byte
        return this.frame.slice(10, 14);
    } else if (length === 126) {
        // extended payload length あり、4byte目から4byte
        return this.frame.slice(4, 8);
    } else {
        // extened payload length なし、2byte目から4byte
        return this.frame.slice(2, 6);
    }
};

Frame.prototype.isMasked = function() {
    return (this.frame[1] & 0x80) === 0x80;
};

Frame.prototype.getPayloadLength = function() {
    var length = this.frame[1] & 0x7f;
    if (length === 127) {
        // TODO 暫定32bitまで対応
        return this.frame.readUInt32BE(6);
    } else if (length === 126) {
        return this.frame.readUInt16BE(2);
    } else {
        return length;
    }
};

exports.Frame = Frame;

/**
 * 複数のフレームのペイロードを合成して単一のバッファを返す
 *
 */
exports.concatPayloadAsText = function(frames) {
    var texts = frames.map(function(item) {
        return item.getPayloadAsText();
    });
    return texts.join();
};


/**
 * テキストから新しいフレームデータを作成する
 * @param {string} text - utf8テキスト
 * @return {Buffer} フレーム
 */
exports.createFrameBufferFromText = function(text) {
    // TODO オリジナルデータが非マスクデータでもマスクしているので修正
    var payload = new Buffer(text, 'utf8');
    var payloadLength = payload.length;
    if (payloadLength > 4294967295) {  // 暫定 32bitまで対応
        return new Buffer();
    }

    var frame;

    var extended = 0;

    if (payloadLength <= 125) {
        frame = new Buffer(6 + payloadLength);
        frame.writeUInt8([0x80 | payloadLength], 1);

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

    frame.writeUInt8(0x81, 0);  // FRAME LAST & TEXT FRAME;

    var maskingKey = createMaskingKey();

    // Masking Key
    maskingKey.copy(frame, 2 + extended);

    // Masking
    var maskedPayload = transformMasking(payload, maskingKey);

    // Payload Data
    maskedPayload.copy(frame, 6 + extended);

    return frame;
};

