import Database from "@tauri-apps/plugin-sql";

// WIKIPEDIAから文を取得する
async function handleGetExampleSentencesClick(e) {
    disableAllButtons(e.target);

    mainList.innerHTML = "<p>読み込み中・・・</p>";
    mainList.className = "example-sent-list";

    try {
        const query = `
            SELECT noun, verb FROM (
                SELECT noun, verb FROM wo_sudachi_normal
                UNION ALL
                SELECT noun, verb FROM wo_sudachi_sahen
            ) 
            ORDER BY RANDOM() 
            LIMIT 300
        `;
        const rows = await db.select(query);

        const allNouns = await db.select("SELECT word FROM noun");
        const allVerbs = await db.select("SELECT word FROM verb");

        const nounSet = new Set(allNouns.map((n) => n.word || n[0]));
        const verbSet = new Set(allVerbs.map((v) => v.word || v[0]));

        const fragment = document.createDocumentFragment();

        for (const row of rows) {
            const noun = row.noun || row[0];
            const verb = row.verb || row[1];

            if (!noun || !verb) continue;

            const isNounExist = nounSet.has(noun);
            const isVerbExist = verbSet.has(verb);

            const nounBtn = isNounExist ? `<button class="delete-word-btn" data-table="noun" data-target="verb" data-word="${noun}">${noun}</button>` : `<button class="good-word-btn" data-table="noun" data-target="verb" data-word="${noun}">${noun}</button>`;
            const verbBtn = isVerbExist ? `<button class="delete-word-btn" data-table="verb" data-target="noun" data-word="${verb}">${verb}</button>` : `<button class="good-word-btn" data-table="verb" data-word="${verb}">${verb}</button>`;

            const li = document.createElement("li");
            li.innerHTML = `${nounBtn}<span class="particle">を</span>${verbBtn}`;

            const separator = document.createElement("span");
            separator.textContent = " / ";

            fragment.appendChild(li);
            fragment.appendChild(separator);
        }

        mainList.innerHTML = "";
        mainList.appendChild(fragment);
    } catch (error) {
        console.error("エラー：", error);
    } finally {
        enableAllButtons();
    }
}

// お気に入り単語（名詞と動詞）から文を生成する
async function handleGenerateSentencesClick(e) {
    disableAllButtons(e.target);

    mainList.innerHTML = "";
    mainList.className = "gen-sent-list";

    const getLimit = 300;

    try {
        const nounList = await db.select(`SELECT word FROM noun ORDER BY RANDOM() LIMIT ${getLimit}`);
        const verbList = await db.select(`SELECT word FROM verb ORDER BY RANDOM() LIMIT ${getLimit}`);

        const allSentences = await db.select("SELECT noun, verb FROM sent");

        const sentSet = new Set(
            allSentences.map((s) => {
                const n = s.noun || s[0];
                const v = s.verb || s[1];
                return `${n}_${v}`;
            }),
        );

        const loopCount = Math.min(nounList.length, verbList.length, getLimit);
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < loopCount; i++) {
            const noun = nounList[i].word || nounList[i][0];
            const verb = verbList[i].word || verbList[i][0];

            const isSentExist = sentSet.has(`${noun}_${verb}`);
            const sentBtnClass = isSentExist ? "delete-sent-btn" : "good-sent-btn";

            const li = document.createElement("li");
            li.innerHTML = `<button class="${sentBtnClass}" data-table="sent" data-noun="${noun}" data-verb="${verb}">${noun}を${verb}</button>`;
            const span = document.createElement("span");
            span.textContent = "/";

            fragment.appendChild(li);
            fragment.appendChild(span);
        }

        mainList.appendChild(fragment);
    } catch (error) {
        console.error("エラー：", error);
    } finally {
        enableAllButtons();
    }
}

//お気に入り文を取得する
async function handleGetFavoriteSentencesClick(e) {
    disableAllButtons(e.target);

    mainList.innerHTML = "";
    mainList.className = "fav-sent-list";

    try {
        const sentList = await db.select("SELECT noun, verb FROM sent");

        for (let i = 0; i < sentList.length; i++) {
            const noun = sentList[i].noun || sentList[i][0];
            const verb = sentList[i].verb || sentList[i][1];
            const li = document.createElement("li");
            li.innerHTML = `<button class="delete-sent-btn" data-table="sent" data-noun="${noun}" data-verb="${verb}">${noun}を${verb}</button>`;
            const span = document.createElement("span");
            span.textContent = "/";
            mainList.prepend(li, span);
        }
    } catch (error) {
        console.error("エラー：", error);
    } finally {
        enableAllButtons();
    }
}

//お気に入り単語（名詞 OR 動詞）を取得する
async function handleGetFavoriteWordsClick(e) {
    disableAllButtons(e.target);

    const table = e.target.dataset.table;
    const getTable = table === "noun" ? "verb" : "noun";

    mainList.innerHTML = "";
    mainList.className = `fav-word-list ${table}`;

    try {
        const wordList = await db.select(`SELECT word FROM ${table}`);

        const fragment = document.createDocumentFragment();

        for (let i = 0; i < wordList.length; i++) {
            const word = wordList[i].word || wordList[i][0];
            const li = document.createElement("li");
            li.innerHTML = `<button class="delete-word-btn" data-table="${table}" data-target="${getTable}" data-word="${word}">${word}</button>`;
            const span = document.createElement("span");
            span.textContent = "/";
            fragment.prepend(li, span);
        }

        mainList.appendChild(fragment);
    } catch (error) {
        console.error("エラー：", error);
    } finally {
        enableAllButtons();
    }
}

//単語（名詞 OR 動詞）を含む文を生成する
async function handleGetSentencesWithWordClick(e) {
    if (e.target.dataset.target) {
        e.preventDefault();
        const target = e.target.dataset.target;

        if (target === "noun") {
            disableAllButtons(verbBtn);
        } else if (target === "verb") {
            disableAllButtons(nounBtn);
        }

        const withWord = e.target.dataset.word;
        const targetTable = e.target.dataset.target;

        mainList.innerHTML = "";
        mainList.className = "with-sent-list";

        try {
            const wordList = await db.select(`SELECT word FROM ${targetTable}`);
            for (let i = 0; i < wordList.length; i++) {
                const word = wordList[i].word || wordList[i][0];
                const li = document.createElement("li");
                li.innerHTML = targetTable === "noun" ? `<button class="good-sent-btn" data-table="sent" data-noun="${word}" data-verb="${withWord}">${word}を${withWord}</button>` : `<button class="good-sent-btn" data-table="sent" data-noun="${withWord}" data-verb="${word}">${withWord}を${word}</button>`;
                const span = document.createElement("span");
                span.textContent = "/";
                mainList.prepend(li, span);
            }
        } catch (error) {
            console.error("エラー：", error);
        } finally {
            enableAllButtons();
        }
    }
}

//単語（名詞 OR 動詞）を保存・削除する
const handleSaveWordClick = async (e) => {
    if (e.target.classList.contains("good-word-btn")) {
        if (e.detail === 0) return;
        const btn = e.target;
        const table = btn.dataset.table;
        const wordText = btn.dataset.word.trim();

        if (!wordText) return;

        try {
            await db.select(`INSERT OR IGNORE INTO ${table} (word) VALUES ('${wordText}')`);
            btn.className = "delete-word-btn";
        } catch (error) {
            console.error("保存失敗：", error);
        }
    } else if (e.target.classList.contains("delete-word-btn")) {
        if (e.detail === 0) return;
        const btn = e.target;
        const table = btn.dataset.table;
        const wordText = btn.dataset.word.trim();

        if (!wordText) return;

        try {
            await db.select(`DELETE FROM ${table} WHERE word = '${wordText}'`);
            btn.className = "good-word-btn";
        } catch (error) {
            console.error("削除失敗：", error);
        }
    }
};

//文を保存・削除する
const handleSaveSentenceClick = async (e) => {
    if (e.detail === 0) return;

    if (e.target.classList.contains("good-sent-btn")) {
        if (e.detail === 0) return;
        const btn = e.target;
        const noun = btn.dataset.noun.trim();
        const verb = btn.dataset.verb.trim();
        try {
            await db.select(`INSERT OR IGNORE INTO sent (noun, verb) VALUES ('${noun}', '${verb}')`);
            btn.className = "delete-sent-btn";
        } catch (error) {
            console.error("保存失敗：", error);
        }
    } else if (e.target.classList.contains("delete-sent-btn")) {
        if (e.detail === 0) return;
        const btn = e.target;
        const noun = btn.dataset.noun.trim();
        const verb = btn.dataset.verb.trim();
        try {
            await db.select(`DELETE FROM sent WHERE noun = '${noun}' AND verb = '${verb}'`);
            btn.className = "good-sent-btn";
        } catch (error) {
            console.error("削除失敗：", error);
        }
    }
};

const handleRegisterClick = async (e) => {
    const nounInput = document.getElementById("registerNounInput");
    const verbInput = document.getElementById("registerVerbInput");

    const nounText = nounInput.value.trim();
    const verbText = verbInput.value.trim();

    if (nounText != "" && verbText === "") {
        if (!nounText) return;
        try {
            await db.select(`INSERT OR IGNORE INTO noun (word) VALUES ('${nounText}')`);
            nounInput.value = "";
        } catch (error) {
            console.error("名詞登録失敗：", error);
        }
    } else if (verbText != "" && nounText === "") {
        if (!verbText) return;
        try {
            await db.select(`INSERT OR IGNORE INTO verb (word) VALUES ('${verbText}')`);
            verbInput.value = "";
        } catch (error) {
            console.error("動詞登録失敗：", error);
        }
    } else if (nounText != "" && verbText != "") {
        if (!nounText || !verbText) return;
        try {
            await db.select(`INSERT OR IGNORE INTO sent (noun, verb) VALUES ('${nounText}', '${verbText}')`);
            nounInput.value = "";
            verbInput.value = "";
        } catch (error) {
            console.error("文登録失敗：", error);
        }
    }
};

const handleKeyup = (e) => {
    if (e.target.id === "registerNounInput" || e.target.id === "registerVerbInput") {
        if (e.key === "Enter" && !e.isComposing) {
            e.target.blur();
        } else {
            const table = e.target.dataset.table;
            const mainListClass = mainList.className;
            if ((mainListClass === "fav-word-list noun" && table === "noun") || (mainListClass === "fav-word-list verb" && table === "verb")) {
                const inputVal = e.target.value.trim();
                const listItems = mainList.querySelectorAll("li");
                listItems.forEach((li) => {
                    const btn = li.querySelector("button");
                    const word = btn.getAttribute("data-word");
                    if (inputVal === "" || word.includes(inputVal)) {
                        li.style.display = "";
                    } else {
                        li.style.display = "none";
                    }
                });
            }
        }
    } else {
        if (e.key === " " || e.key === "　") {
            randomBtn.click();
        } else if (e.key === "f") {
            sentBtn.click();
        } else if (e.key === "w") {
            nounBtn.click();
        } else if (e.key === "e") {
            verbBtn.click();
        } else if (e.key === "a") {
            wikiBtn.click();
        } else if (e.key === "r") {
            registerBtn.click();
        } else if (e.key === "Enter") {
            if (mainList.className === "fav-word-list noun") {
                nounInput.focus();
            } else if (mainList.className === "fav-word-list verb") {
                verbInput.focus();
            }
        }
    }
};

function disableAllButtons(currentBtn) {
    const buttons = document.getElementById("searchBox").querySelectorAll("button");
    buttons.forEach((button) => {
        button.disabled = true;
        button.classList.remove("active");
    });
    currentBtn.classList.add("active");
}

function enableAllButtons() {
    const buttons = document.getElementById("searchBox").querySelectorAll("button");
    buttons.forEach((button) => {
        button.disabled = false;
    });
}

//初期化
let db;
let mainList = null;
let nounBtn = null;
let verbBtn = null;
let nounInput = null;
let verbInput = null;
let randomBtn = null;
let sentBtn = null;
let wikiBtn = null;
let registerBtn = null;

window.addEventListener("DOMContentLoaded", async () => {
    try {
        const DB = import.meta.env.VITE_DB;
        console.log(DB);
        db = await Database.load(DB);
        console.log("データベース接続完了");
    } catch (error) {
        console.error("データベース接続失敗:", error);
        document.getElementById("resultArea").innerHTML = `<p style="color:red;">データベース接続失敗: ${error}</p>`;
    }

    mainList = document.getElementById("mainList");
    nounBtn = document.getElementById("nounBtn");
    verbBtn = document.getElementById("verbBtn");
    nounInput = document.getElementById("registerNounInput");
    verbInput = document.getElementById("registerVerbInput");
    randomBtn = document.getElementById("randomBtn");
    sentBtn = document.getElementById("sentBtn");
    wikiBtn = document.getElementById("wikiBtn");
    registerBtn = document.getElementById("registerBtn");

    randomBtn.addEventListener("click", handleGenerateSentencesClick);
    sentBtn.addEventListener("click", handleGetFavoriteSentencesClick);
    wikiBtn.addEventListener("click", handleGetExampleSentencesClick);
    nounBtn.addEventListener("click", handleGetFavoriteWordsClick);
    verbBtn.addEventListener("click", handleGetFavoriteWordsClick);
    registerBtn.addEventListener("click", handleRegisterClick);

    document.addEventListener("keyup", handleKeyup);

    mainList.addEventListener("click", handleSaveWordClick);
    mainList.addEventListener("click", handleSaveSentenceClick);
    mainList.addEventListener("contextmenu", handleGetSentencesWithWordClick);

    wikiBtn.click();
});
