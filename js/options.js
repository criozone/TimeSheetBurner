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
                    if (!item) return;
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

    var taskUrlColumn = null;
    var currentSheet = null;

    $(document).on("click", '#close-tasks-button', function(){
        chrome.storage.sync.get("currentSheet", function(chromStorage){
            if (!chromStorage.currentSheet) {
                console.log('Error loading current sheet');
                return;
            }
            currentSheet = chromStorage.currentSheet;
            var range = 'timesheet';
            chrome.identity.getAuthToken({interactive: true}, function(token){
                let init = {
                    method: 'GET',
                    async: true,
                    headers: {
                        Authorization: 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    'contentType': 'json'
                };
                fetch(
                    'https://sheets.googleapis.com/v4/spreadsheets/' + currentSheet.spredsheetId + '/values/' + range + '?valueRenderOption=FORMATTED_VALUE&key=' + API_KEY,
                    init
                )
                .then((response) => response.json())
                .then(function(data) {
                    if (!data.hasOwnProperty('values') || data.values.length < 1) return;
                    var sheet = data.values;
                    taskUrlColumn = sheet[0].length -1;
                    var filledByDefaultRowsOffset = 2;
                    var shortCardIds = [];

                    for (let i = filledByDefaultRowsOffset; i < sheet.length; i++) {
                        if (typeof sheet[i][taskUrlColumn] !== 'undefined') {
                            shortCardIds.push(
                                {
                                    "id": (sheet[i][taskUrlColumn].match(/trello\.com\/.+\/(.+)\/\d+.+/i))[1],
                                    "row": i
                                }
                            );
                        }
                    }

                    for (let i  = 0; i < shortCardIds.length; i++) {
                        checkTask(shortCardIds[i]);
                    }
                });
            });
        });
    });

    var checkTask = function(shortTaskData, spreadsheetIndex) {
        var today = (new Date()).getDate();
        let init = {
            method: 'GET',
            async: true,
            headers: {
                'Content-Type': 'application/json'
            },
            'contentType': 'json'
        };
        fetch(
            'https://api.trello.com/1/cards/' + shortTaskData.id + '/list?key=' + trelloPublicKey + '&token=' +  trelloToken,
            init
        ).then((response) => response.json()).then(function(data){
            var closedFlag = false;
            if (data.name.search('Done') > -1) {
                closedFlag = true;
            } else if (data.name.search(/Documentation\s+\(Teo\)/i) > -1) {
                closedFlag = true;
            } else if (data.name.search(/Ready\s+for\s+Live\s+\(BJ\)/i) > -1) {
                closedFlag = true;
            } else if(today > 27 && data.name.search('EFC Dev Testing Input') > -1) { // Если конец месяца - повышаем производительность
                closedFlag = true;
            } else if(today > 27 && data.name.search('EFC Live Testing Input') > -1) {
                closedFlag = true;
            }
            if (closedFlag)
                closeTask(shortTaskData.row);
        });
    }
    var closeTask = function(rowIndex){
        var totalHoursColumn = taskUrlColumn - 2;
        var repeatCell = {
            range: {
				sheetId: currentSheet.sheetId,
				startRowIndex: rowIndex,
				endRowIndex: rowIndex + 1,
				startColumnIndex: totalHoursColumn,
				endColumnIndex: totalHoursColumn + 1
			},
			cell: {
				userEnteredFormat: {
					backgroundColor: {
						red: 0.502, //182,
						green: 0.843, //215,
						blue: 0.659, //168,
						alpha: 1
					}
				}
			},
			fields: "userEnteredFormat.backgroundColor"
        };
        chrome.identity.getAuthToken({interactive: true}, function(token){
            let init = {
                method: 'POST',
                async: true,
                headers: {
                    Authorization: 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                'contentType': 'json',
                body: JSON.stringify({
                    requests: [
                        {repeatCell: repeatCell}
                    ]
                })
            };
            fetch(
                'https://sheets.googleapis.com/v4/spreadsheets/' + currentSheet.spredsheetId + ':batchUpdate?key=' + API_KEY,
                init
            ).then((response) => response.json()).then(function(markData){
                console.log(markData);
            });
        });
    };
});