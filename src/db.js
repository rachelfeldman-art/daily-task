require('dotenv/config');
const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Create a .env file from .env.example and add your Neon connection string.');
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

module.exports = { db, sql };
