/**
 * Life Tracker backend — deploy this as a Web App bound to your Google Sheet.
 * Setup instructions are in README.md.
 */

// Change this to any secret string you like. The web app must be given the
// same value in the front-end settings screen, otherwise requests are rejected.
var SECRET_TOKEN = 'REPLACE_WITH_YOUR_OWN_SECRET';

var HEADERS = {
  Fitness: ['Date', 'Type', 'Duration', 'Calories', 'Notes'],
  Health: ['Date', 'Weight', 'Sleep', 'Mood', 'Water', 'Notes'],
  Expenses: ['Date', 'Category', 'Description', 'Amount', 'Method'],
  Finances: ['Date', 'Type', 'Amount', 'Notes'],
  Time: ['Date', 'Activity', 'Category', 'Hours', 'Notes']
};

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(HEADERS[name]);
  }
  return sheet;
}

function readSheet_(name) {
  var sheet = getSheet_(name);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = { _row: i + 1 };
    for (var c = 0; c < headers.length; c++) {
      var val = data[i][c];
      row[headers[c]] = (val instanceof Date) ? val.toISOString() : val;
    }
    rows.push(row);
  }
  return rows;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    if (e.parameter.token !== SECRET_TOKEN) return jsonOut_({ error: 'Unauthorized' });
    var sheetName = e.parameter.sheet;
    if (sheetName === 'all') {
      var result = {};
      Object.keys(HEADERS).forEach(function (name) {
        result[name] = readSheet_(name);
      });
      return jsonOut_(result);
    }
    if (!HEADERS[sheetName]) return jsonOut_({ error: 'Unknown sheet: ' + sheetName });
    return jsonOut_(readSheet_(sheetName));
  } catch (err) {
    return jsonOut_({ error: err.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.token !== SECRET_TOKEN) return jsonOut_({ error: 'Unauthorized' });

    var sheetName = body.sheet;
    if (!HEADERS[sheetName]) return jsonOut_({ error: 'Unknown sheet: ' + sheetName });
    var sheet = getSheet_(sheetName);

    if (body.action === 'delete') {
      sheet.deleteRow(body.row);
      return jsonOut_({ success: true });
    }

    var headers = HEADERS[sheetName];
    var row = headers.map(function (h) {
      var v = body.data[h];
      return (v === undefined || v === null) ? '' : v;
    });
    sheet.appendRow(row);
    return jsonOut_({ success: true });
  } catch (err) {
    return jsonOut_({ error: err.message });
  }
}
