import Database from 'better-sqlite3';

const db = new Database('data/job-hunt-vibe.sqlite');
const tableInfo = db.prepare('PRAGMA table_info(resumes)').all();
console.log('Resumes Schema:', tableInfo);
