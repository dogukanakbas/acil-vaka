import sqlite3

def check_db():
    conn = sqlite3.connect('backend/acilvaka.db')
    cursor = conn.cursor()
    
    # Get list of tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables:", tables)
    
    for table in tables:
        table_name = table[0]
        cursor.execute(f"PRAGMA table_info({table_name});")
        info = cursor.fetchall()
        print(f"\nTable {table_name}:")
        for col in info:
            print(f"  {col[1]} ({col[2]})")
            
    conn.close()

if __name__ == '__main__':
    check_db()
