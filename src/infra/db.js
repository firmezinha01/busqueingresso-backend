import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true'
  }
})

export default pool

