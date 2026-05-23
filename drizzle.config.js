const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  schema: './schema.js',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
});
