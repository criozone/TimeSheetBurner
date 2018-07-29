$(function(){
    var taskUrlColumn = null;
    var currentSheet = null;
    var closedTasks = 0;

    $(document).on("click", 'button.close-tasks', function(){
        $('#closed-tasks-counter').css('visibility', 'visible');
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
                closedTasks++;
                $('#closed-tasks-counter span').html(closedTasks);
            });
        });
    };
});