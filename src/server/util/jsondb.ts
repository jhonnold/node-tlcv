import { existsSync, readFileSync, writeFileSync } from 'fs';

class JsonDB {
  private fsPath: string;

  constructor(fsPath: string) {
    this.fsPath = fsPath;

    if (!existsSync(this.fsPath)) writeFileSync(this.fsPath, '{}');
  }

  private loadDb(): Record<string, unknown> {
    const data = readFileSync(this.fsPath, { encoding: 'utf-8' });
    return JSON.parse(data);
  }

  private saveDb(data: Record<string, unknown>): void {
    writeFileSync(this.fsPath, JSON.stringify(data, null, 4), { encoding: 'utf-8' });
  }

  public create<V>(key: string, value: V): void {
    const db = this.loadDb();
    if (db[key] !== undefined) {
      throw new Error(`Key '${key}' already exists.`);
    }
    db[key] = value;
    this.saveDb(db);
  }

  public read<V>(key: string): V | null {
    const db = this.loadDb();

    return (db[key] as V) || null;
  }

  public update<V>(key: string, value: V): void {
    const db = this.loadDb();
    if (db[key] === undefined) {
      throw new Error(`Key '${key}' does not exist.`);
    }
    db[key] = value;
    this.saveDb(db);
  }

  public delete(key: string): void {
    const db = this.loadDb();
    if (db[key] === undefined) {
      throw new Error(`Key '${key}' does not exist.`);
    }
    db[key] = undefined;
    this.saveDb(db);
  }
}

export default JsonDB;
