require('dotenv/config');
const { defineConfig } = require('drizzle-kit');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in the .env file');
}

module.exports = defineConfig({
  schema: './src/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
