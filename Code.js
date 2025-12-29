function doGet(e) {
  const month = e.parameter.month || getCurrentMonth();
  return ContentService.createTextOutput(
    JSON.stringify({
      people: getPeople(),
      history: getHistory(month),
      stats: getStats(month),
      months: getAvailableMonths()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}


function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);

    if (params.action === "delete") {
      deleteExpense(params.rowIndex, params.month);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "deleted" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    saveExpense(params);
    return ContentService.createTextOutput(
      JSON.stringify({ status: "saved" })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}


function deleteExpense(rowIndex, month) {
  if (!rowIndex || rowIndex < 2) {
    throw new Error("Invalid rowIndex: " + rowIndex);
  }
  const sheet = getDynamicSheetByMonth(month);
  sheet.deleteRow(rowIndex);
}


// Hàm này giữ nguyên
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getInitialData() {
  try {
    return {
      people: getPeople(),
      history: getHistory(),
      stats: getStats(),
      months: getAvailableMonths()
    };
  } catch (e) {
    throw new Error("Failed to load data: " + e.message);
  }
}

function getPeople() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('People');
  if (!sheet) return ["Bon", "Chin"];
  return sheet.getRange(2, 1, sheet.getLastRow()).getValues().flat().filter(String);
}

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// string-base
function getDynamicSheetByMonth(month) {
  const ss = SpreadsheetApp.getActive();
  const sheetName = month || getCurrentMonth();

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    const template = ss.getSheetByName('Template');
    if (template) {
      sheet = template.copyTo(ss).setName(sheetName);
    } else {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(["Date", "Amount", "Payer", "Shared With", "Note"]);
    }
  }

  return sheet;
}

function getAvailableMonths() {
  return SpreadsheetApp.getActive().getSheets()
    .map(sheet => sheet.getName())
    .filter(name => /^\d{4}-\d{2}$/.test(name))
    .sort()
    .reverse();
}

function getHistory(month) {
  const sheet = getDynamicSheetByMonth(month);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return [];

  return data
    .slice(1)
    .map((row, i) => ({
      rowIndex: i + 2, // real row index in sheet
      date: row[0] instanceof Date
        ? Utilities.formatDate(row[0], "GMT+7", "dd/MM")
        : row[0],
      amount: row[1],
      payer: row[2],
      note: row[4]
    }))
    .reverse();
    // .slice(0, 20);
}


function getStats(month) {
  const sheet = getDynamicSheetByMonth(month);
  const data = sheet.getDataRange().getValues();
  data.shift();
  const stats = {};
  data.forEach(row => {
    const payer = row[2];
    const amount = parseFloat(row[1]) || 0;
    if (payer) stats[payer] = (stats[payer] || 0) + amount;
  });
  return stats;
}

function saveExpense(data) {
  const sheet = getDynamicSheetByMonth(data.month || getCurrentMonth());
  sheet.appendRow([data.date, data.amount, data.payer, data.sharedWith.join(", "), data.note]);
  return true;
}