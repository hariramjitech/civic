require('dotenv').config();
const mongoose = require('mongoose');
const { Post } = require('./models/models');

const categoryMapping = {
  pothole: 'roads',
  road_damage: 'roads',
  garbage: 'sanitation',
  water_leakage: 'water',
  drainage: 'sanitation',
  streetlight: 'electricity',
  public_property: 'municipal',
  electricity: 'electricity',
  other: 'other'
};

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
      const oldCat = post.category;
      if (categoryMapping[oldCat] && categoryMapping[oldCat] !== oldCat) {
        const newCat = categoryMapping[oldCat];
        console.log(`Migrating post ${post._id}: "${oldCat}" ➔ "${newCat}"`);
        post.category = newCat;
        await post.save({ validateBeforeSave: false }); // bypass in case other fields don't validate
        updatedCount++;
      } else if (!['roads', 'sanitation', 'water', 'electricity', 'municipal', 'other'].includes(oldCat)) {
        // If it's something else not in the new list, default to other
        console.log(`Migrating post ${post._id} with unknown category "${oldCat}" ➔ "other"`);
        post.category = 'other';
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
