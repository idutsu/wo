import sqlite3
import multiprocessing as mp
from sudachipy import dictionary, tokenizer
import tqdm
import os

# --- 設定：ここを変更しました ---
INPUT_FILE = 'wikipedia_sentences.txt'
DB_FILE = 'pairs.sqlite3'  # ファイル名を変更
TABLE_NAME = 'wo2'        # テーブル名を定数化
TOTAL_LINES = 27863628 
CHUNK_SIZE = 10000 
NUM_PROCS = mp.cpu_count()

tokenizer_obj = None
mode = None

def init_worker():
    global tokenizer_obj, mode
    try:
        tokenizer_obj = dictionary.Dictionary(dict="full").create()
    except Exception:
        tokenizer_obj = dictionary.Dictionary().create()
    mode = tokenizer.Tokenizer.SplitMode.C

def process_chunk(lines):
    results = []
    for line in lines:
        line = line.strip()
        if not line: continue
        try:
            tokens = tokenizer_obj.tokenize(line, mode)
            for i in range(len(tokens) - 2):
                t1, t2, t3 = tokens[i], tokens[i+1], tokens[i+2]
                if (t1.part_of_speech()[0] == '名詞' and 
                    t2.surface() == 'を' and 
                    t3.part_of_speech()[0] == '動詞'):
                    results.append((t1.normalized_form(), t3.dictionary_form()))
        except Exception as e:
            continue
    return results

def file_reader(file_path, chunk_size):
    with open(file_path, 'r', encoding='utf-8') as f:
        chunk = []
        for line in f:
            chunk.append(line)
            if len(chunk) >= chunk_size:
                yield chunk
                chunk = []
        if chunk: yield chunk

def main():
    print(f"--- 解析開始（ターゲット: {DB_FILE} / テーブル: {TABLE_NAME}） ---")
    
    conn = sqlite3.connect(DB_FILE)
    # WSLでのI/Oエラー対策として、同期設定をゆるくし、WALを適用
    conn.execute('PRAGMA synchronous = OFF')
    conn.execute('PRAGMA journal_mode = WAL')
    cursor = conn.cursor()
    
    # テーブル名を wo2 に変更
    cursor.execute(f'''
        CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
            noun TEXT, 
            verb TEXT, 
            PRIMARY KEY (noun, verb)
        )
    ''')
    conn.commit()

    with mp.Pool(processes=NUM_PROCS, initializer=init_worker) as pool:
        reader = file_reader(INPUT_FILE, CHUNK_SIZE)
        pbar = tqdm.tqdm(total=TOTAL_LINES, desc="Processing", unit="lines")
        
        try:
            for pair_list in pool.imap_unordered(process_chunk, reader):
                if pair_list:
                    # テーブル名を wo2 に変更
                    cursor.executemany(
                        f'INSERT OR IGNORE INTO {TABLE_NAME} (noun, verb) VALUES (?, ?)', 
                        pair_list
                    )
                    conn.commit()
                pbar.update(CHUNK_SIZE)
        except KeyboardInterrupt:
            print("\n中断しました。")
        finally:
            pbar.close()

    print("インデックスを作成中...")
    cursor.execute(f'CREATE INDEX IF NOT EXISTS idx_noun_{TABLE_NAME} ON {TABLE_NAME}(noun)')
    conn.commit()
    
    conn.close()
    print(f"完了！ {DB_FILE} の {TABLE_NAME} テーブルに保存されました。")

if __name__ == "__main__":
    main()