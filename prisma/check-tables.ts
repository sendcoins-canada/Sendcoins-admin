import { PrismaClient } from '@prisma/client';

const PRODUCTION_DB_URL = 'postgresql://postgres:tEEzardachicago11!@database-1.cihiwyaqc8kv.us-east-1.rds.amazonaws.com:5432/sendcoin_pgdb?schema=public';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PRODUCTION_DB_URL,
    },
  },
});

// All models from schema.prisma
const schemaModels = [
  'AdminAuditLog',
  'AdminRefreshToken',
  'AdminUser',
  'Department',
  'Role',
  'RolePermission',
  'AdminNotification',
  'apple_user_names',
  'azer_auth_token',
  'azer_bnb_wallet',
  'azer_btc_wallet',
  'azer_eth_wallet',
  'azer_hash',
  'azer_ltc_wallet',
  'azer_password_recovery',
  'azer_pol_wallet',
  'azer_sol_wallet',
  'azer_trx_wallet',
  'azer_usdc_wallet',
  'azer_usdt_wallet',
  'bank_account',
  'bank_list',
  'coin_network',
  'currency',
  'email_oauth',
  'merchants',
  'otp_verifications',
  'otp_verify',
  'pin_auth',
  'recipients',
  'send_coin_user',
  'survey_config',
  'survey_questions',
  'survey_sessions',
  'transaction_history',
  'user_notifications',
  'user_survey_responses',
  'wallet_transfers',
  'fiat_bank_transfers',
  'coin_azer_verify_user',
];

async function checkTables() {
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
    
    console.log('\n📊 Database Tables vs Prisma Schema Comparison\n');
    console.log('='.repeat(80));
    
    console.log(`\n✅ Tables in Database: ${dbTableNames.length}`);
    console.log(`✅ Tables in Prisma Schema: ${schemaModels.length}\n`);
    
    // Find tables in DB but not in schema
    const missingInSchema = dbTableNames.filter(name => !schemaModels.includes(name));
    
    // Find tables in schema but not in DB
    const missingInDB = schemaModels.filter(name => !dbTableNames.includes(name));
    
    if (missingInSchema.length > 0) {
      console.log('⚠️  Tables in DATABASE but NOT in Prisma Schema:');
      console.log('   (These will be DROPPED if you run prisma db push!)');
      missingInSchema.forEach(name => {
        console.log(`   - ${name}`);
      });
      console.log('');
    }
    
    if (missingInDB.length > 0) {
      console.log('❌ Tables in Prisma Schema but NOT in DATABASE:');
      missingInDB.forEach(name => {
        console.log(`   - ${name}`);
      });
      console.log('');
    }
    
    if (missingInSchema.length === 0 && missingInDB.length === 0) {
      console.log('✅ All tables match! Database and Prisma schema are in sync.\n');
    }
    
    console.log('\n📋 All Database Tables:');
    dbTableNames.forEach((name, idx) => {
      const inSchema = schemaModels.includes(name) ? '✅' : '❌';
      console.log(`   ${idx + 1}. ${inSchema} ${name}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  IMPORTANT:');
    console.log('   - prisma db push can DROP tables not in schema');
    console.log('   - Use prisma migrate deploy for production (safer)');
    console.log('   - Always backup before running schema changes\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();

