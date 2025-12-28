function doGet(e) {
  const month = e.parameter.month;
  console.log("Received month parameter:", month);
  return ContentService.createTextOutput(
    JSON.stringify({
      people: getPeople(),
      history: getHistory(month),
      stats: getStats(month)
    })
  ).setMimeType(ContentService.MimeType.JSON);
}


function doPost(e) {
  const params = JSON.parse(e.postData.contents);

  if (params.action === "delete") {
    deleteExpense(params.rowIndex, params.month);
    return ContentService.createTextOutput(
      JSON.stringify({ status: "deleted" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  saveExpense(params);
  return ContentService.createTextOutput(
    JSON.stringify({ status: "success" })
  ).setMimeType(ContentService.MimeType.JSON);
}

function deleteExpense(rowIndex, month) {
  if (!rowIndex || rowIndex < 2) {
    throw new Error("Invalid rowIndex: " + rowIndex);
  }

  const date = month ? new Date(month + "-01") : new Date();
  const sheet = getDynamicSheet(date);

  Logger.log("Deleting row: " + rowIndex + " from " + sheet.getName());
  sheet.deleteRow(rowIndex);
}


// Hàm này giữ nguyên
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Hàm lấy dữ liệu tổng hợp (Chỉ gọi 1 lần duy nhất)
function getInitialData() {
  try {
    return {
      people: getPeople(),
      history: getHistory(),
      stats: getStats()
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

function getDynamicSheet(inputDateString) {
  const ss = SpreadsheetApp.getActive();
  const dateObj = inputDateString ? new Date(inputDateString) : new Date();
  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid date provided to getDynamicSheet");
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let sheetName;
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();

  if (year <= 2025) {
    sheetName = monthNames[month];
  } else {
    const monthFormatted = (month + 1).toString().padStart(2, '0');
    sheetName = year + "_" + monthFormatted;
  }

  let sheet = ss.getSheetByName(sheetName);

  // Tùy chọn: Nếu sheet tháng mới chưa tồn tại, tự động tạo mới từ một sheet mẫu (Template)
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

function getHistory(inputMonth) {
  const date = inputMonth ? new Date(inputMonth + "-01") : new Date();
  const sheet = getDynamicSheet(date);
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


function getStats(inputMonth) {
  const date = inputMonth ? new Date(inputMonth + "-01") : new Date();
  const sheet = getDynamicSheet(date);
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
  const sheet = getDynamicSheet(data.date);
  sheet.appendRow([data.date, data.amount, data.payer, data.sharedWith.join(", "), data.note]);
  return true;
}