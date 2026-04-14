from typing import TextIO
import csv
import sqlite3
import json
import sys
import os

def populateTable(cur: sqlite3.Cursor, name: str, fh: TextIO):
    reader = csv.reader(fh, delimiter=',', quotechar='"')
    headers, *rows = reader
    query = f"INSERT INTO {name} ({', '.join(headers)}) VALUES ({', '.join('?' * len(headers))})"
    cur.executemany(query, rows)

def main():
    directory = sys.argv[1]
    isUser = directory.endswith('user')

    dbPath = directory + '.db'
    if os.path.exists(dbPath):
        os.remove(dbPath)
    conn = sqlite3.connect(dbPath)

    cur = conn.cursor()

    with open('config/db-schema.json') as fh:
        schema = json.load(fh)['user' if isUser else 'system']

    for table in schema:
        query = f'CREATE TABLE {table["name"]}(\n'
        for col in table['columns']:
            query += f'    {col["name"]} {col["type"]},\n'
        query = query[:-2] + '\n'
        query += ')\n'
        print(query)
        cur.execute(query)

        if isUser: continue
        tablePath = directory + '/' + table['name'] + '.csv'
        if os.path.exists(tablePath):
            print(tablePath)
            with open(tablePath) as fh:
                populateTable(cur, table['name'], fh)

    cur.close()
    conn.commit()

if __name__ == '__main__':
    main()

