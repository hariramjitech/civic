const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 50,   // handle high concurrent TN-wide load
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      family: 4,           // Force IPv4 — fixes connection on Reliance/Jio IPv6 networks
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    await seedContacts();
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

const seedContacts = async () => {
  try {
    const { Contact } = require('../models/models');
    const count = await Contact.countDocuments();
    if (count > 0) return;

    const dataPath = path.join(__dirname, '../data/tn_contacts.json');
    if (!fs.existsSync(dataPath)) return;

    const contacts = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    await Contact.insertMany(contacts);
    console.log(`✅ Seeded ${contacts.length} Tamil Nadu official contacts`);
  } catch (err) {
    console.warn('⚠️  Contact seeding skipped:', err.message);
  }
};

module.exports = connectDB;
