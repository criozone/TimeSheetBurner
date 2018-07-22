$(document).ready(function(){
    var currentSheet = null;
    setCurrentSheetIndicator = function(){
        chrome.storage.sync.get("currentSheet", function(chromStorage){
            if (chromStorage.currentSheet) {
                currentSheet = chromStorage.currentSheet;
                $('#current-wrapper').html('<a href="' + chromStorage.currentSheet.link + '" target="_blank">' + chromStorage.currentSheet.name + '</a>');
            }
        });
    };
    setCurrentSheetIndicator();

    $('button#add-task').on('click', function(){
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {needTAsksUrl: true}, function(response) {
                var fullTasksUrl = response.tasksUrl;
                var taskTitle = response.taskTitle;
                var taskUrlPath = (fullTasksUrl.indexOf('?') > -1) ? fullTasksUrl.substring(0, fullTasksUrl.indexOf('?')) : fullTasksUrl;
                var taskId = (fullTasksUrl.match(/trello\.com\/.+\/(.+)\/\d+.+/i))[1];
                if (!taskId) {
                    console.log('Task id not found! Url: ' + fullTasksUrl);
                    return;
                }
                var range = 'timesheet';
				$('.result-wrapper').addClass('loading');
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
                        var taskUrlColumn = sheet[0].length -1;
                        var taskNameColumn = 1;
                        var filledByDefaultRowsOffset = 2;
                        var searchedRow = null;
                        var lastFilledRow = filledByDefaultRowsOffset - 1;
                        for (let i = filledByDefaultRowsOffset; i < sheet.length; i++) {
                            if (sheet[i].length > 0 && (sheet[i][taskNameColumn]).length > 0) {
                                lastFilledRow = i;
                            }
                            if (typeof sheet[i][taskUrlColumn] !== 'undefined') {
                                if (sheet[i][taskUrlColumn].indexOf(taskId) > -1) searchedRow = i;
                            }
                        }
                        if (searchedRow) {
                            markDay(searchedRow);
                        } else {
                            markDay(lastFilledRow + 1);
                            var rowValues = Array(sheet[0].length).fill('');
                            rowValues[0] = "ersties"; //TODO: take from Trello.
                            rowValues[1] = taskTitle;
                            rowValues[taskUrlColumn] = taskUrlPath;
                            var fromCell = getCellName(lastFilledRow + 1, 2);
                            var toCell = getCellName(lastFilledRow + 1, taskUrlColumn - 3);
                            var taskHoursFormula = "=СУММ(" + fromCell + ":" + toCell + ")";
                            rowValues[taskUrlColumn - 2] = taskHoursFormula;
                            addRow(lastFilledRow + 1, rowValues);
                        }
                    });
                });
            });
        });

    });
    var markDay = function(rowIndex){
        var dayOfMonth = (new Date()).getDate();
        var daysOffsetInSheet = 2;
        var dayColumn = dayOfMonth -1 + daysOffsetInSheet;
        var repeatCell = {
            range: {
				sheetId: currentSheet.sheetId,
				startRowIndex: rowIndex,
				endRowIndex: rowIndex + 1,
				startColumnIndex: dayColumn,
				endColumnIndex: dayColumn + 1
			},
			cell: {
				userEnteredFormat: {
					backgroundColor: {
						red: 60,
						green: 120,
						blue: 216,
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
                $('.result-wrapper').addClass('loaded');
                console.log(markData);
            });
        });
    };
    var addRow = function(rowIndex, rowValues){
        chrome.identity.getAuthToken({interactive: true}, function(token){
            let init = {
                method: 'PUT',
                async: true,
                headers: {
                    Authorization: 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                'contentType': 'json',
                body: JSON.stringify({
                    values: [
                        rowValues
                    ]
                })
            };
            fetch(
                'https://sheets.googleapis.com/v4/spreadsheets/' + currentSheet.spredsheetId + '/values/A' + (rowIndex + 1) + '?valueInputOption=USER_ENTERED&key=' + API_KEY,
                init
            ).then((response) => response.json()).then(function(appendData){
                console.log(appendData);
            });
        });
    }
    var getCellName = function(rowIndex, columnIndex) {
        let cellMap = {
            1: "A",	2: "B",	3: "C",	4: "D",	5: "E",	6: "F",	7: "G",	8: "H",	9: "I",	10: "G", 11: "K", 12: "L", 13: "M", 14: "N", 15: "O", 16: "P", 17: "Q", 18: "R", 19: "S", 20: "T", 21: "U", 22: "V", 23: "W", 24: "X", 25: "Y", 26: "Z"
        };
        let rowNumber = rowIndex + 1;
        let columnNumber = columnIndex + 1;
        if (columnNumber <= 26) {
            return cellMap[columnNumber] + rowNumber;
        }
        let ostatok = columnNumber % 26;
        return "A" + cellMap[ostatok] + rowNumber;
    }
});