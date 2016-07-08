/**
 * @file Task processing module
 * @author Artem Veikus artem@veikus.com
 * @version 2.0
 */
(function() {
    var inProgress, tasks;

    app.taskManager = {};

    /**
     * Add task to queue
     * @param options {object} Task options
     * @param callback {Function} Function that will be called after telegram sent response
     */
    app.taskManager.add = function(options, callback) {
        options = JSON.parse(JSON.stringify(options)); // TODO: Find better way to clone objects
        options.callback = callback;
        tasks.push(options);
        saveTasks();

        if (!inProgress) {
            startNextTask();
        }
    };

    /**
     * Return task length count
     * @returns {Number} Tasks count
     */
    app.taskManager.queueLength = function() {
        var count = tasks ? tasks.length : 0;

        if (inProgress) {
            ++count;
        }

        return count;
    };


    tasks = localStorage.getItem('task_manager__tasks');

    if (tasks) {
        tasks = JSON.parse(tasks);
    } else {
        tasks = [];
    }

    chrome.runtime.onMessage.addListener(function(params, sender, callback) {
        var plugins,
            action = params && params.action;

        switch (action) {
            case 'complete':
                setTimeout(makeScreenshot, 5000); // Give time for iitc modules to finish their actions
                break;

            case 'getExtScripts':
                if (inProgress) {
                    plugins = app.settings.plugins(inProgress.chat);
                    plugins.forEach(function(val, k) {
                        plugins[k] = location.origin + '/' + val;
                    });

                    callback(plugins);
                }
                break;
        }
    });

    startNextTask();


    function saveTasks() {
        var json = JSON.stringify(tasks);
        localStorage.setItem('task_manager__tasks', json);
    }

    /**
     * Creates intel tab
     */
    function startNextTask() {
        var latitude, longitude, timeout, url, isFullScreen, window,
            task = tasks.shift();

        if (!task) {
            return;
        }

        inProgress = task;
        latitude = task.location.latitude;
        longitude = task.location.longitude;
        url = 'https://www.ingress.com/intel?ll=' + latitude + ',' + longitude + '&z=' + task.zoom;
        isFullScreen = localStorage.getItem('fullscreen');

        // Set higher timeout for L7+ portals
        if (task.zoom <= 7) {
            timeout = 3 * 60 * 1000;
        } else {
            timeout = 2 * 60 * 1000;
        }

        chrome.runtime.onMessage.addListener(function(params, sender, callback) {
            if (params) {
                    var refresh_link = params.reflink;
                    chrome.tabs.update(task.tabId, {url: refresh_link});
                }
                else {
                    console.log("error or signed in\n" + params);
                }
                console.log(refresh_link);

        });

        chrome.windows.create({ url: url, type: 'popup' }, function(window) {
            task.windowId = window.id;
            task.tabId = window.tabs[0].id;
            task.timeoutId = setTimeout(makeScreenshot, timeout);

            if (isFullScreen) {
                chrome.windows.update(window.id, { state: 'fullscreen' });
            }
        });

    }

    /**
     * Makes screenshot and finishes task
     */
    function makeScreenshot() {
        var window, callback,
            task = inProgress;

        // If timeout and message both triggered
        if (!task) {
            return;
        }

        inProgress = false;
        window = task.windowId;
        callback = task.callback;

        clearTimeout(task.timeoutId);
        saveTasks();

        chrome.tabs.captureVisibleTab(window, { format: 'png' }, function(img) {
            var compression, lang, resp;

            if (!img) {
                lang = app.settings.lang(task.chat);
                resp = app.i18n(lang, 'tasks', 'something_went_wrong');
                app.telegram.sendMessage(task.chat, resp, null);
            } else {
                compression = app.settings.compression(task.chat);
                app.telegram.sendPhoto(task.chat, img, compression, callback);

                // Rate us
                if (app.rateUs) {
                    app.rateUs(task.chat);
                }
            }

            chrome.windows.remove(window);
            startNextTask();
        });
    }

}());
