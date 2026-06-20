require('dotenv').config();
const mongoose = require('mongoose');
const { Post, Contact } = require('./models/models');

async function migrate() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected successfully!');

    // Fetch all posts
    const posts = await Post.find({});
    console.log(`Found ${posts.length} posts to inspect.`);

    let updatedCount = 0;
    for (const post of posts) {
      const district = post.district;
      const category = post.category;
      
      console.log(`Processing post ${post._id} [District: ${district}, Category: ${category}]`);

      // Find contacts for this district and category
      const contactQuery = { district };
      if (category && category !== 'other') {
        contactQuery.department = category;
      }
      let contacts = await Contact.find(contactQuery);

      // If no direct department match, fallback to 'municipal' contact for that district
      if (contacts.length === 0) {
        contacts = await Contact.find({
          district,
          department: 'municipal'
        });
      }

      // If still no contact matches, fallback to all contacts of that district
      if (contacts.length === 0) {
        contacts = await Contact.find({ district });
      }

      const newContactIds = contacts.map(c => c._id.toString());
      const oldContactIds = post.attachedContacts ? post.attachedContacts.map(id => id.toString()) : [];

      // Sort and compare arrays to see if they're identical
      const hasChanged = 
        newContactIds.length !== oldContactIds.length ||
        !newContactIds.every(id => oldContactIds.includes(id));

      if (hasChanged) {
        console.log(`Updating contacts for post ${post._id}: [${oldContactIds.join(', ')}] ➔ [${newContactIds.join(', ')}]`);
        post.attachedContacts = contacts.map(c => c._id);
        await post.save({ validateBeforeSave: false });
        updatedCount++;
      }
    }

    console.log(`Migration completed. Updated ${updatedCount} posts.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
