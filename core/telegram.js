(function() {
    var TOKEN = 'YOUR TOKEN HERE',
        API_URL = 'https://api.telegram.org/bot' + TOKEN,
        TIMEOUT = 10,
        offset = localStorage.getItem('telegram_offset') || 0,
        chatSettings = localStorage.getItem('chatSettings') || '{}';

    app.telegram = {};

    /**
     * Send message to specified chat
     * @param chatId {Number} Chat id
     * @param message {String} Message
     * @param markup {Object|undefined|null} Keyboard markup (null hides previous keyboard, undefined leaves it)
     */
    app.telegram.sendMessage = function(chatId, message, markup) {
        var url;

        if (markup === null) {
            markup = { hide_keyboard: true };
        }

        markup = JSON.stringify(markup);
        url = API_URL + '/sendMessage';

        request('post', url, {
            chat_id: chatId,
            text: message,
            disable_web_page_preview: true,
            reply_markup: markup
        });
    };

    /**
     * Send photo to specified chat
     * @param chatId {Number} Chat id
     * @param photo {String} Base64 encrypted image
     * @param compression {Boolean} If true image will be compressed by telegram
     * @param callback {Function} Callback function
     */
    app.telegram.sendPhoto = function(chatId, photo, compression, callback) {
        var url = API_URL + (compression ? '/sendPhoto' : '/sendDocument'),
            params = {};

        params.chat_id = chatId;
        params[compression ? 'photo' : 'document'] = photo;

        request('post', url, params, function(data) {
            if (typeof callback === 'function') {
                callback(data && data.ok, data.description);
            }
        });
    };

    /**
     * Get new messages from server
     * @param callback {Function} Callback function
     */
    app.telegram.getUpdates = function(callback) {
        var result = [],
            url = API_URL + '/getUpdates';

        request('get', url, { timeout: TIMEOUT, offset: offset }, function(data) {
            if (data && data.ok) {
                data.result.forEach(function(val) {
                    result.push(val.message);
                    offset = val.update_id + 1;
                    localStorage.setItem('telegram_offset', offset);
                });

                callback(result);
            } else {
                callback(null);
            }
        })
    };

    /**
     * Request wrapper
     * @param method {String} GET or POST
     * @param url {String} Request url
     * @param data {Object} Request parameters
     * @param callback {Function} Callback function
     */
    function request(method, url, data, callback) {
        var formData, i,
            xmlhttp = new XMLHttpRequest();

        if (typeof callback !== 'function') {
            callback = undefined;
        }

        if (method.toLowerCase() === 'post') {
            formData = new FormData();

            for (i in data) {
                if (!data.hasOwnProperty(i)) {
                    continue;
                }

                if (i === 'photo') {
                    formData.append('photo', dataURItoBlob(data[i]), 'screen.png');
                } else if (i === 'document') {
                    formData.append('document', dataURItoBlob(data[i]), 'screen.png');
                } else {
                    formData.append(i, data[i]);
                }
            }
        } else {
            url += '?' + serialize(data);
        }

        xmlhttp.onreadystatechange = function() {
            var result = null;

            if (xmlhttp.readyState !== 4) {
                return;
            }

            try {
                result = JSON.parse(xmlhttp.responseText);
            } catch (e) {
                console.error('JSON parse error: ' + e);
            }

            if (callback) {
                callback(result);
            }
        };

        xmlhttp.open(method, url, true);
        xmlhttp.send(formData);
    }

    function serialize(obj) {
        var p,
            str = [];

        for (p in obj)
            if (obj.hasOwnProperty(p)) {
                str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
            }

        return str.join('&');
    }

    /**
     * Convert base64 to raw binary data held in a string
     */
    function dataURItoBlob(dataURI) {
        var mimeString, ab, ia, i,
            byteString = atob(dataURI.split(',')[1]);

        // separate out the mime component
        mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

        // write the bytes of the string to an ArrayBuffer
        ab = new ArrayBuffer(byteString.length);
        ia = new Uint8Array(ab);
        for (i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }

        return new Blob([ab], {type: mimeString});
    }
}());