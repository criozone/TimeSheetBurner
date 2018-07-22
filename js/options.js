$(function(){
    chrome.storage.sync.get("oldSheets", function(chromStorage){
        if (!chromStorage.hasOwnProperty('oldSheets')) {
            chrome.storage.sync.set({
                "oldSheets": []
            });
        }
    });

    updateCurrentSheetIndicator = function(){
        chrome.storage.sync.get("currentSheet", function(chromStorage){
            if (chromStorage.currentSheet) {
                $('#currentsheet-link').html('<a href="' + chromStorage.currentSheet.link + '" target="_blank">' + chromStorage.currentSheet.name + '</a>');
                $('#currentsheet-id').html(chromStorage.currentSheet.spredsheetId);
            }
        });
    };
    updateCurrentSheetIndicator();

    updateOldSheetsIndicator = function() {
        chrome.storage.sync.get("oldSheets", function(chromStorage){
            if (chromStorage.oldSheets) {
                var sheetsList = '';
                chromStorage.oldSheets.forEach(function(item, i, arr){
                    sheetsList += '<li><a href="' + item.link + '" target="_blank">' + item.name + '</a><span class="delete-sheet" data-index="' + i + '"></span></li>';
                });
                $('#sheets-list').html(sheetsList);
            }
        });
    };
    updateOldSheetsIndicator();

    chrome.storage.onChanged.addListener(function(changes, area) {
        if (changes.currentSheet) {
            var oldCurrentValue = changes.currentSheet.oldValue;
            chrome.storage.sync.get("oldSheets", function(chromStorage){
                var inOldSheetsFlag = false;
                var oldSheets = chromStorage.oldSheets;
                for (let i = 0; i < oldSheets.length; i++) {
                    if (oldSheets[i].spredsheetId.localeCompare(oldCurrentValue.spredsheetId) == 0 ) 
                        inOldSheetsFlag = true;
                }
                if (inOldSheetsFlag) return;

                oldSheets.unshift(oldCurrentValue);
                chrome.storage.sync.set({"oldSheets": oldSheets}, function(){
                    updateOldSheetsIndicator();
                });
            });
        }
    });

    $(document).on("click", '#currentsheet-button', function(){
        var newCurrentSheetId = ($('#currentsheet-input').val()).trim();
        $('#currentsheet-input').val('');
        if (newCurrentSheetId.length < 1) return;
        chrome.identity.getAuthToken({interactive: true}, function(token){
            let init = {
                method: 'GET',
                async: true,
                headers: {
                    Authorization: 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                'contentType': 'json',
            };
            fetch(
                'https://sheets.googleapis.com/v4/spreadsheets/' + newCurrentSheetId + '?key=' + API_KEY,
                init
            ).then((response) => response.json()).then(function(sheetDAta){
                console.log(sheetDAta);
                var sheetName = sheetDAta.properties.title;
                var firstSheetId = sheetDAta.sheets[0].properties.sheetId;
                var spreadsheetLink = sheetDAta.spreadsheetUrl;
                chrome.storage.sync.set({
                    "currentSheet": {
                        "link": spreadsheetLink,
                        "name": sheetName,
                        "spredsheetId": newCurrentSheetId,
                        "sheetId": firstSheetId
                    }
                }, function(){
                    updateCurrentSheetIndicator();
                });
            });
        });
    });

    $(document).on("click", '.delete-sheet', function() {
        var indexToDelete = $(this).data('link');
        chrome.storage.sync.get("oldSheets", function(storage){
            var oldSheets = storage.oldSheets;
            oldSheets.splice(indexToDelete, 1);
            chrome.storage.sync.set({"oldSheets": oldSheets}, function(){
                updateOldSheetsIndicator();
            });
        });
    });



    /* 
        TODO:
        1) Handle "close-tasks"
        2) Select sheet to edit("timsheet", "summary", "Правильное заполнение")
        3) Индикатор загрузки/работы (load.gif)
    */
    $(document).on("click", '#close-tasks-button', function(){
        // This is just a test:
		console.log('Does nothing yet.');
    });
});