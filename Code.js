// Thay thế hàm doGet cũ
function doGet(e) {
  const data = getInitialData(); // Hàm lấy people, history, stats của bạn
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Hàm doPost để nhận dữ liệu từ GitHub gửi sang
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    
    // Gọi hàm lưu vào Sheet của bạn (giả sử tên là saveToSheet)
    const result = saveDataToSheet(params); 
    
    return ContentService.createTextOutput(JSON.stringify({status: "success", data: result}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
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

function getHistory() {
  const now = new Date();
  const sheet = getDynamicSheet(now);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  data.shift();
  return data.reverse().slice(0, 10).map(row => ({
    date: row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT+7", "dd/MM") : row[0],
    amount: row[1],
    payer: row[2],
    note: row[4]
  }));
}

function getStats() {
  const now = new Date();
  const sheet = getDynamicSheet(now);
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