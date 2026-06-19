require('dotenv').config();
const { clerkClient } = require('@clerk/express');

console.log('Testing Clerk API getUser call...');
clerkClient.users.getUser('user_123')
  .then(user => {
    console.log('Success:', user);
    process.exit(0);
  })
  .catch(err => {
    console.log('Caught expected error or failure:');
    console.log('Message:', err.message);
    console.log('Status:', err.status);
    process.exit(0);
  });
