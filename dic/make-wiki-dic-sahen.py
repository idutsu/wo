import sqlite3
import multiprocessing as mp
from sudachipy import dictionary, tokenizer
import tqdm
import os

# --- 設定 ---
INPUT_FILE = 'wikipedia_sentences.txt'
DB_FILE = '../pairs.sqlite3'
TABLE_NAME = 'wo3'        # テーブル名を wo3 に変更
TOTAL_LINES = 27863628 
CHUNK_SIZE = 10000 
NUM_PROCS = mp.cpu_count()

tokenizer_obj = None
mode = None

def init_worker():
    """各ワーカープロセスで1回だけ実行される初期化関数（元ロジック完全維持）"""
    global tokenizer_obj, mode
    try:
        tokenizer_obj = dictionary.Dictionary(dict="full").create()
    except Exception:
        tokenizer_obj = dictionary.Dictionary().create()
    mode = tokenizer.Tokenizer.SplitMode.C

def process_chunk(lines):
    """
    1チャンク分の解析
    パターン: [名詞] + [を] + [サ変可能名詞]
    保存形式: [名詞], [サ変可能名詞 + する]
    """
    results = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            tokens = tokenizer_obj.tokenize(line, mode)
            # 3つのトークンをスライドしながらチェック
            for i in range(len(tokens) - 2):
                t1, t2, t3 = tokens[i], tokens[i+1], tokens[i+2]
                
                # 品詞情報の取得
                pos1 = t1.part_of_speech()
                pos3 = t3.part_of_speech()
                
                # 条件判定: 名詞 + を + サ変可能名詞
                if (pos1[0] == '名詞' and 
                    t2.surface() == 'を' and 
                    pos3[0] == '名詞' and pos3[2] == 'サ変可能'):
                    
                    noun = t1.normalized_form()
                    # サ変名詞に「する」を付与して保存
                    sahen_verb = t3.normalized_form() + "する"
                    results.append((noun, sahen_verb))
                    
        except Exception as e:
            # エラーログ出力（維持）
            tqdm.tqdm.write(f"Error in line: {str(e)[:100]}")
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
        if chunk:
            yield chunk

def main():
    print(f"--- 解析開始（ターゲット: {DB_FILE} / テーブル: {TABLE_NAME}） ---")
    
    conn = sqlite3.connect(DB_FILE)
    conn.execute('PRAGMA synchronous = OFF')
    conn.execute('PRAGMA journal_mode = WAL')
    cursor = conn.cursor()
    
    # wo3 テーブルを作成
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
        pbar = tqdm.tqdm(total=TOTAL_LINES, desc="Processing Wikipedia (Sa-hen)", unit="lines")
        
        try:
            for pair_list in pool.imap_unordered(process_chunk, reader):
                if pair_list:
                    cursor.executemany(
                        f'INSERT OR IGNORE INTO {TABLE_NAME} (noun, verb) VALUES (?, ?)', 
                        pair_list
                    )
                    conn.commit()
                pbar.update(CHUNK_SIZE)
        except KeyboardInterrupt:
            print("\n中断されました。")
        finally:
            pbar.close()

    print(f"{TABLE_NAME} のインデックスを作成中...")
    cursor.execute(f'CREATE INDEX IF NOT EXISTS idx_noun_{TABLE_NAME} ON {TABLE_NAME}(noun)')
    conn.commit()
    
    conn.close()
    print(f"完了！ {DB_FILE} の {TABLE_NAME} テーブルに保存されました。")

if __name__ == "__main__":
    main()