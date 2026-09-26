import initSqlJs from 'sql.js';
import { access, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  await access(resolve(root, 'prisma/dev.db'));
  console.log('Local database already exists; leaving its data unchanged.');
  process.exit(0);
} catch {}
const SQL = await initSqlJs({ locateFile: file => resolve(root, 'node_modules/sql.js/dist', file) });
const db = new SQL.Database();
const schema = await readFile(resolve(root, 'prisma/migrations/initial.sql'), 'utf8');
db.exec(schema);
await writeFile(resolve(root, 'prisma/dev.db'), Buffer.from(db.export()));
db.close();
console.log('Created an empty CodeVeritas SQLite database at prisma/dev.db');
