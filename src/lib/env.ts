// Side-effect module: load env vars before any other module reads process.env.
// Import this FIRST in standalone scripts (tsx). The Next.js app loads .env.local
// automatically, so this is only needed for the ingest/eval scripts.
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })
