import { PrismaClient } from '@prisma/client';

/**
 * Script to list all tables and their row counts in both databases
 */

const PRODUCTION_DB_URL = 'postgresql://postgres:tEEzardachicago11!@database-1.cihiwyaqc8kv.us-east-1.rds.amazonaws.com:5432/sendcoin_pgdb?schema=public';
const LOCAL_DB_URL = 'postgresql://postgres@localhost:5432/sendcoins_admin_local?schema=public';

const productionPrisma = new PrismaClient({
  datasources: {
    db: {
      url: PRODUCTION_DB_URL,
    },
  },
});

const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: LOCAL_DB_URL,
    },
  },
});

const allTables = [
  // Admin tables
  'AdminUser',
  'Department',
  'Role',
  'RolePermission',
  'AdminAuditLog',
  // Production tables
  'send_coin_user',
  'merchants',
  'transaction_history',
  'wallet_transfers',
  'recipients',
  'user_notifications',
  'bank_account',
  'bank_list',
  'currency',
  'coin_network',
  'azer_btc_wallet',
  'azer_eth_wallet',
  'azer_bnb_wallet',
  'azer_sol_wallet',
  'azer_trx_wallet',
  'azer_usdt_wallet',
  'azer_usdc_wallet',
  'azer_pol_wallet',
  'azer_ltc_wallet',
  'azer_auth_token',
  'azer_password_recovery',
  'azer_hash',
  'email_oauth',
  'otp_verifications',
  'otp_verify',
  'pin_auth',
  'apple_user_names',
  'survey_config',
  'survey_questions',
  'survey_sessions',
  'user_survey_responses',
];

async function getTableCount(prisma: PrismaClient, tableName: string): Promise<number> {
  try {
    let result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "${tableName}"`
    );
    return Number(result[0]?.count || 0);
  } catch (error: any) {
    try {
      const lowerName = tableName.toLowerCase();
      const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "${lowerName}"`
      );
      return Number(result[0]?.count || 0);
    } catch (e: any) {
      return -1;
    }
  }
}

async function listDatabase(prisma: PrismaClient, dbName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${dbName} DATABASE`);
  console.log('='.repeat(80));
  console.log(`${'Table Name'.padEnd(40)} | ${'Row Count'.padStart(10)}`);
  console.log('-'.repeat(80));

  const results: Array<{ table: string; count: number }> = [];

  for (const table of allTables) {
    const count = await getTableCount(prisma, table);
    if (count >= 0) {
      results.push({ table, count });
      console.log(`${table.padEnd(40)} | ${count.toString().padStart(10)}`);
    }
  }

  const totalRows = results.reduce((sum, r) => sum + r.count, 0);
  console.log('-'.repeat(80));
  console.log(`${'TOTAL'.padEnd(40)} | ${totalRows.toString().padStart(10)}`);
  
  return results;
}

async function main() {
  console.log('📊 Listing all tables in both databases...\n');

  let prodResults: Array<{ table: string; count: number }> = [];
  let localResults: Array<{ table: string; count: number }> = [];

  try {
    await productionPrisma.$queryRaw`SELECT 1`;
    prodResults = await listDatabase(productionPrisma, 'PRODUCTION');
  } catch (error: any) {
    console.log('\n❌ Could not connect to PRODUCTION database');
    console.log(`   Error: ${error.message}`);
    console.log('   Make sure you have VPN access or the database is reachable\n');
  }

  try {
    await localPrisma.$queryRaw`SELECT 1`;
    localResults = await listDatabase(localPrisma, 'LOCAL');
  } catch (error: any) {
    console.log('\n❌ Could not connect to LOCAL database');
    console.log(`   Error: ${error.message}\n`);
  }

  // Comparison
  if (prodResults.length > 0 && localResults.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('COMPARISON');
    console.log('='.repeat(80));
    console.log(`${'Table Name'.padEnd(40)} | ${'PROD'.padStart(10)} | ${'LOCAL'.padStart(10)} | ${'Diff'.padStart(10)}`);
    console.log('-'.repeat(80));

    const allTablesSet = new Set([...prodResults.map(r => r.table), ...localResults.map(r => r.table)]);
    
    for (const table of Array.from(allTablesSet).sort()) {
      const prodCount = prodResults.find(r => r.table === table)?.count || 0;
      const localCount = localResults.find(r => r.table === table)?.count || 0;
      const diff = prodCount - localCount;
      const diffStr = diff > 0 ? `+${diff}` : diff.toString();
      
      console.log(
        `${table.padEnd(40)} | ${prodCount.toString().padStart(10)} | ${localCount.toString().padStart(10)} | ${diffStr.padStart(10)}`
      );
    }
  }

  await productionPrisma.$disconnect().catch(() => {});
  await localPrisma.$disconnect().catch(() => {});
}

main().catch(console.error);







