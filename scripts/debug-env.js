const dotenv = require('dotenv');
const path = require('path');

// Explicitly load .env.local from the root
const result = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (result.error) {
  console.error("Failed to load .env.local:", result.error);
} else {
  console.log("Environment variables loaded from .env.local successfully.");
}

console.log("CRON_SECRET:", process.env.CRON_SECRET ? "Check Passed" : "Check Failed (Undefined or Empty)");
console.log("NODE_ENV (at process start):", process.env.NODE_ENV);
