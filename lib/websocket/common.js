'use strict';

/**
 * マスク用のキーを作成します
 * @return {Buffer}
 */
exports.createMaskingKey = function() {
    var buf = new Buffer(4);
    for (var i = 0; i < 4; i++) {
        buf.writeUInt8(Math.floor(Math.random() * 256), i);
    }
    return buf;
};

/**
 * マスキング、アンマスキング処理を行います
 *
 * @param {Buffer} payload - ペイロード
 * @param {Buffer} key - 任意の32bitの値、長さ4のbuffer
 * @return {Buffer} マスク・アンマスクされたペイロード
 */
exports.applyMasking = function(payload, key) {
    if (key.length !== 4) {
        throw new Error('key is not 32bit');
    }

    var transformedData = new Buffer(payload.length);
    for (var i = 0; i < payload.length; i++) {
        var j = i % 4;
        transformedData[i] = payload[i] ^ key[j];
    }

    return transformedData;
};
