const db = require('./database/db');

async function testDB() {
  try {
    // Test connection
    const [connection] = await db.query('SELECT 1');
    console.log('✅ Connection test:', connection);

    // Test classes with proper array handling
    const [classRows] = await db.query('SELECT * FROM classes');
    const classes = Array.isArray(classRows) ? classRows : [classRows].filter(Boolean);
    console.log('📚 Classes:', classes);
    console.log(`🏷️ Class count: ${classes.length}`);

    // Test races with proper array handling
    const [raceRows] = await db.query('SELECT * FROM races');
    const races = Array.isArray(raceRows) ? raceRows : [raceRows].filter(Boolean);
    console.log('🧬 Races:', races);
    console.log(`🏷️ Race count: ${races.length}`);
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

testDB();