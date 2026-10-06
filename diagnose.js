/**
 * diagnose.js — Dumps actual column names from the live database
 * Run with: node diagnose.js
 */
const { query } = require('./db');

async function run() {
  console.log('\n🔍 Fetching actual table + column names from database...\n');

  try {
    // Show all tables and columns in public schema
    const result = await query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    let currentTable = '';
    result.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n📋 Table: "${currentTable}"`);
        console.log('   ' + '-'.repeat(60));
      }
      console.log(`   ${row.column_name.padEnd(28)} ${row.data_type}`);
    });

    console.log('\n\n✅ Done.\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  process.exit(0);
}

run();
