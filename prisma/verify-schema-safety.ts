import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const PRODUCTION_DB_URL = 'postgresql://postgres:tEEzardachicago11!@database-1.cihiwyaqc8kv.us-east-1.rds.amazonaws.com:5432/sendcoin_pgdb?schema=public';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PRODUCTION_DB_URL,
    },
  },
});

/**
 * This script verifies that all tables in the database exist in the Prisma schema
 * Run this BEFORE running any Prisma commands to ensure safety
 */
async function verifySchemaSafety() {
  try {
    // Get all tables from database
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const dbTableNames = tables.map(t => t.table_name);
    
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    
    // Extract model names from schema
    const modelMatches = schemaContent.matchAll(/^model\s+(\w+)\s*\{/gm);
    const schemaModels = Array.from(modelMatches).map(m => m[1]);
    
    console.log('\n🔍 Prisma Schema Safety Check\n');
    console.log('='.repeat(80));
    
    // Find tables in DB but not in schema
    const missingInSchema = dbTableNames.filter(name => !schemaModels.includes(name));
    
    // Find tables in schema but not in DB
    const missingInDB = schemaModels.filter(name => !dbTableNames.includes(name));
    
    if (missingInSchema.length > 0) {
      console.log('\n❌ CRITICAL: Tables in DATABASE but NOT in Prisma Schema:');
      console.log('   ⚠️  These tables WILL BE DROPPED if you run "prisma db push"!\n');
      missingInSchema.forEach(name => {
        console.log(`   - ${name}`);
      });
      console.log('\n   💡 Solution: Add these models to schema.prisma before running Prisma commands\n');
      process.exit(1);
    }
    
    if (missingInDB.length > 0) {
      console.log('\n⚠️  Tables in Prisma Schema but NOT in DATABASE:');
      console.log('   These tables need to be created via migration\n');
      missingInDB.forEach(name => {
        console.log(`   - ${name}`);
      });
    }
    
    if (missingInSchema.length === 0 && missingInDB.length === 0) {
      console.log('\n✅ SAFE: All database tables are present in Prisma schema');
      console.log(`   Database: ${dbTableNames.length} tables`);
      console.log(`   Schema: ${schemaModels.length} models`);
      console.log('\n✅ You can safely run Prisma commands\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySchemaSafety();

