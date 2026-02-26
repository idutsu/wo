const Database = window.__TAURI__.sql;

let db;

async function initDB() {
  try {
    db = await Database.load('sqlite:C:/Users/email/wo/pairs.sqlite3');
    console.log("データベース接続完了");
  } catch (error) {
    console.error("データベース接続失敗:", error);
    document.getElementById('resultArea').innerHTML = `<p style="color:red;">データベース接続失敗: ${error}</p>`;
  }
}

// メインの検索処理
async function search() {
  if (!db) return;
  
  const word = document.getElementById('searchInput').value.trim();
  const searchType = document.querySelector('input[name="searchType"]:checked').value;
  const resultArea = document.getElementById('resultArea');
  const resultHeader = document.querySelector('.result-header p');
  
  if (!word) {
    resultArea.innerHTML = "<p>文字を入力してください。</p>";
    return;
  }

  if (searchType === 'noun') {
    resultHeader.innerHTML = `結果：<span id="currentWord">${word}</span> を ...`;
  } else {
    resultHeader.innerHTML = `結果：... を <span id="currentWord">${word}</span>`;
  }

  resultArea.innerHTML = "<p>検索中...</p>";

  try {
    const searchCol = searchType === 'noun' ? 'noun' : 'verb';
    const displayCol = searchType === 'noun' ? 'verb' : 'noun';
    const limit = 30; // メイン検索の表示件数

    // ★修正：メイン検索でも +1件 取得して続きがあるかチェックする
    const result = await db.select(
      `SELECT * FROM wo WHERE ${searchCol} = $1 ORDER BY cnt DESC LIMIT ${limit + 1}`, 
      [word]
    );

    if (result.length === 0) {
      resultArea.innerHTML = "<p>何も見つかりませんでした。</p>";
      return;
    }

    let hasMore = false;
    if (result.length > limit) {
      hasMore = true;
      result.pop(); // 31件目を削る
    }

    let html = `<ul class="main-list" data-word="${word}" data-type="${searchType}">`;
    for (const row of result) {
      const targetWord = row[displayCol];
      html += `
        <li class="list-item">
          <div class="item-content" data-word="${targetWord}" data-type="${displayCol}">
            <span class="toggle-icon"></span> 
            <span class="word">${targetWord}</span> 
            <span class="cnt">(${row.cnt})</span>
            <span class="search">[SEARCH]</span>
            <span class="delete">[DEL]</span>
          </div>
        </li>`;
    }

    if (hasMore) {
      html += `
        <li class="load-more-container">
          <button class="load-more-btn" data-word="${word}" data-type="${searchType}" data-offset="${limit}" data-limit="${limit}">MORE</button>
        </li>`;
    }

    html += '</ul>';
    
    resultArea.innerHTML = html;

  } catch (error) {
    console.error("検索失敗：", error);
    resultArea.innerHTML = `<p style="color:red;">検索失敗： ${error}</p>`;
  }
}

async function handleSubSearch(itemContent) {
  const icon = itemContent.querySelector('.toggle-icon');
  const search = itemContent.querySelector('.search');
  const parentLi = itemContent.closest('.list-item');
  
  const word = itemContent.getAttribute('data-word');
  const type = itemContent.getAttribute('data-type'); 

  const existingSubList = parentLi.querySelector(':scope > .sub-list');
  if (existingSubList) {
    if (existingSubList.style.display === 'none') {
      existingSubList.style.display = 'block';
      icon.textContent = "▼";
      search.textContent = "[CLOSE]";
    } else {
      existingSubList.style.display = 'none';
      icon.textContent = "▶";
      search.textContent = "[OPEN]";
    }
    return;
  }

  try {
    const searchCol = type; 
    const displayCol = type === 'noun' ? 'verb' : 'noun';
    const limit = 10; // サブ検索の表示件数

    const result = await db.select(
      `SELECT * FROM wo WHERE ${searchCol} = $1 ORDER BY cnt DESC LIMIT ${limit + 1}`, 
      [word]
    );

    if (result.length === 0) return;

    let hasMore = false;
    if (result.length > limit) {
      hasMore = true;
      result.pop();
    }

    let subHtml = '<ul class="sub-list">';
    for (const row of result) {
      const targetWord = row[displayCol];
      subHtml += `
        <li class="list-item">
          <div class="item-content" data-word="${targetWord}" data-type="${displayCol}">
            <span class="toggle-icon"></span>
            <span class="word">${targetWord}</span> 
            <span class="cnt">(${row.cnt})</span>
            <span class="search">[SEARCH]</span>
            <span class="delete">[DEL]</span>
          </div>
        </li>`;
    }
    
    if (hasMore) {
      subHtml += `
        <li class="load-more-container">
          <button class="load-more-btn" data-word="${word}" data-type="${type}" data-offset="${limit}" data-limit="${limit}">MORE</button>
        </li>`;
    }
    
    subHtml += '</ul>';

    parentLi.insertAdjacentHTML('beforeend', subHtml);
    icon.textContent = "▼";
    search.textContent = "[CLOSE]";
  } catch (error) {
    console.error("検索失敗:", error);
  }
}

async function loadMore(btn) {
  const word = btn.getAttribute('data-word');
  const type = btn.getAttribute('data-type');
  const offset = parseInt(btn.getAttribute('data-offset'), 10);
  const limit = parseInt(btn.getAttribute('data-limit'), 10);
  
  const parentUl = btn.closest('ul');
  const containerLi = btn.closest('.load-more-container');

  btn.textContent = "読み込み中...";
  btn.disabled = true;

  try {
    const searchCol = type; 
    const displayCol = type === 'noun' ? 'verb' : 'noun';

    const result = await db.select(
      `SELECT * FROM wo WHERE ${searchCol} = $1 ORDER BY cnt DESC LIMIT ${limit + 1} OFFSET $2`, 
      [word, offset]
    );

    let hasMore = false;
    if (result.length > limit) {
      hasMore = true;
      result.pop();
    }

    let appendHtml = '';
    for (const row of result) {
      const targetWord = row[displayCol];
      appendHtml += `
        <li class="list-item">
          <div class="item-content" data-word="${targetWord}" data-type="${displayCol}">
            <span class="toggle-icon"></span>
            <span class="word">${targetWord}</span> 
            <span class="cnt">(${row.cnt})</span>
            <span class="search">[SEARCH]</span>
            <span class="delete">[DEL]</span>
          </div>
        </li>`;
    }

    containerLi.remove();
    parentUl.insertAdjacentHTML('beforeend', appendHtml);

    if (hasMore) {
      const nextOffset = offset + limit;
      parentUl.insertAdjacentHTML('beforeend', `
        <li class="load-more-container">
          <button class="load-more-btn" data-word="${word}" data-type="${type}" data-offset="${nextOffset}" data-limit="${limit}">MORE</button>
        </li>`);
    }

  } catch (error) {
    console.error("読み込み失敗：", error);
    btn.textContent = "読み込み失敗";
  }
}

let maxRowId = 0;

window.addEventListener("DOMContentLoaded", async () => {
  await initDB();

  const maxIdResult = await db.select("SELECT MAX(rowid) as max_id FROM wo");
  if (maxIdResult.length > 0) {
    maxRowId = maxIdResult[0].max_id;
    console.log(`最大行数: ${maxRowId}件`);
  }

  const randomData = await getRandomWords(); 
  writeRandomWord(randomData);

  startAutoRandom();
  
  document.getElementById('searchBtn').addEventListener('click', search);

  document.getElementById('resultArea').addEventListener('click', (e) => {
    if (e.target.classList.contains('load-more-btn')) {
      loadMore(e.target);
      return; 
    }

    if (e.target.classList.contains('search')) {
      const itemContent = e.target.closest('.item-content');
      if (itemContent) {
        handleSubSearch(itemContent);
        return;
      }
    }

    if (e.target.classList.contains('delete')) {
      const listItem = e.target.closest('.list-item');
      if (listItem) {
        listItem.remove();
        return;
      }
    }
  });
});


// 超高速・安全なランダム取得関数
async function getRandomWords() {
  if (!db || maxRowId === 0) return null;

  try {
    const randomId = Math.floor(Math.random() * maxRowId) + 1;

    const result = await db.select(
      "SELECT noun, verb FROM wo WHERE rowid >= $1 LIMIT 1", 
      [randomId]
    );

    if (result.length > 0) {
      return { noun: result[0].noun, verb: result[0].verb };
    }
    return null;

  } catch (error) {
    console.error("ランダム取得エラー:", error);
    return null;
  }
}

let randomInterval = null;

function startAutoRandom() {
  if (randomInterval) clearInterval(randomInterval);

  console.log("自動ランダム取得を開始します...");

  randomInterval = setInterval(async () => {
    const randomData = await getRandomWords(); 
    writeRandomWord(randomData);
  }, 10000); // 10000 = 10秒
}

function writeRandomWord(data) {
  if (data) {
      const titleSpan = document.getElementById('randomTitleText');
      if (titleSpan) {
        titleSpan.textContent = `〜${data.noun}を${data.verb}〜`;
      }
    }
}

function stopAutoRandom() {
  if (randomInterval) {
    clearInterval(randomInterval);
    randomInterval = null;
    console.log("自動ランダム取得を停止しました。");
  }
}