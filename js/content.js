chrome.runtime.sendMessage({inTrelloPage: true});
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.needTAsksUrl) {
        var taskTitle = $('div.window-title h2').text();
        sendResponse({tasksUrl: window.location.href, taskTitle: taskTitle});
    }
});