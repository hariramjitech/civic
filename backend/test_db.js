require('dotenv').config();
const mongoose = require('mongoose');

console.log('Starting DB Connection Test...');
console.log('URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s for fast feedback
  family: 4,
})
.then(conn => {
  console.log('✅ Connected successfully!');
  console.log('Host:', conn.connection.host);
  process.exit(0);
})
.catch(err => {
  console.error('❌ Connection failed:', err.message);
  console.error(err);
  process.exit(1);
});
