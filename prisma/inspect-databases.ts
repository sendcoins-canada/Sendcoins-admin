import { PrismaClient } from '@prisma/client';

/**
 * Script to inspect both production and local databases
 * This helps understand the data structure and what needs to be seeded
 */

const PRODUCTION_DB_URL = 'postgresql://postgres:tEEzardachicago11!@database-1.cihiwyaqc8kv.us-east-1.rds.amazonaws.com:5432/sendcoin_pgdb?schema=public';
const LOCAL_DB_URL = 'postgresql://postgres@localhost:5432/sendcoins_admin_local?schema=public';

// Create Prisma clients for both databases
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

interface TableInfo {
  tableName: string;
  rowCount: number;
  sampleData?: any[];
}

async function getTableNames(prisma: PrismaClient): Promise<string[]> {
  // Get all table names from Prisma schema
  const models = [
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
    
    // Wallet tables
    'azer_btc_wallet',
    'azer_eth_wallet',
    'azer_bnb_wallet',
    'azer_sol_wallet',
    'azer_trx_wallet',
    'azer_usdt_wallet',
    'azer_usdc_wallet',
    'azer_pol_wallet',
    'azer_ltc_wallet',
    
    // Auth tables
    'azer_auth_token',
    'azer_password_recovery',
    'azer_hash',
    'email_oauth',
    'otp_verifications',
    'otp_verify',
    'pin_auth',
    'apple_user_names',
    
    // Survey tables
    'survey_config',
    'survey_questions',
    'survey_sessions',
    'user_survey_responses',
  ];

  return models;
}

async function getTableCount(prisma: PrismaClient, tableName: string): Promise<number> {
  try {
    // Try with quotes first (PascalCase)
    let result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "${tableName}"`
    );
    return Number(result[0]?.count || 0);
  } catch (error: any) {
    // Try lowercase/snake_case
    try {
      const lowerName = tableName.toLowerCase();
      const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "${lowerName}"`
      );
      return Number(result[0]?.count || 0);
    } catch (e: any) {
      // Table might not exist
      return -1;
    }
  }
}

async function getSampleData(prisma: PrismaClient, tableName: string, limit: number = 3): Promise<any[]> {
  try {
    // Try with quotes first (PascalCase)
    let result = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${tableName}" LIMIT ${limit}`
    );
    // Convert BigInt to string for JSON serialization
    return JSON.parse(JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )) || [];
  } catch (error: any) {
    // Try lowercase/snake_case
    try {
      const lowerName = tableName.toLowerCase();
      const result = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${lowerName}" LIMIT ${limit}`
      );
      return JSON.parse(JSON.stringify(result, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )) || [];
    } catch (e: any) {
      return [];
    }
  }
}

async function inspectDatabase(prisma: PrismaClient, dbName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Inspecting ${dbName} database`);
  console.log('='.repeat(80));

  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log(`✓ Connected to ${dbName}`);
  } catch (error) {
    console.error(`✗ Failed to connect to ${dbName}:`, error);
    return;
  }

  const tableNames = await getTableNames(prisma);
  const tableInfos: TableInfo[] = [];

  for (const tableName of tableNames) {
    const rowCount = await getTableCount(prisma, tableName);
    if (rowCount >= 0) {
      let sampleData: any[] = [];
      if (rowCount > 0 && rowCount <= 100) {
        // Only get samples for small tables
        sampleData = await getSampleData(prisma, tableName, 2);
      }
      
      tableInfos.push({
        tableName,
        rowCount,
        sampleData: sampleData.length > 0 ? sampleData : undefined,
      });

      console.log(`  ${tableName.padEnd(40)} : ${rowCount.toString().padStart(6)} rows`);
    }
  }

  // Show sample data for tables with data
  console.log(`\n--- Sample Data (for tables with data) ---`);
  for (const info of tableInfos) {
    if (info.sampleData && info.sampleData.length > 0) {
      console.log(`\n${info.tableName}:`);
      console.log(JSON.stringify(info.sampleData, null, 2));
    }
  }

  return tableInfos;
}

async function main() {
  console.log('Starting database inspection...\n');

  let productionInfo: TableInfo[] = [];
  let localInfo: TableInfo[] = [];

  try {
    // Inspect production database
    productionInfo = await inspectDatabase(productionPrisma, 'PRODUCTION') || [];

    // Inspect local database
    localInfo = await inspectDatabase(localPrisma, 'LOCAL') || [];

    // Compare tables
    console.log(`\n${'='.repeat(80)}`);
    console.log('COMPARISON SUMMARY');
    console.log('='.repeat(80));
    console.log('\nTables with data in PRODUCTION but not in LOCAL:');
    
    const prodTables = new Map(productionInfo.map(t => [t.tableName, t.rowCount]));
    const localTables = new Map(localInfo.map(t => [t.tableName, t.rowCount]));

    for (const [tableName, prodCount] of prodTables.entries()) {
      const localCount = localTables.get(tableName) || 0;
      if (prodCount > 0 && localCount === 0) {
        console.log(`  ${tableName.padEnd(40)} : PROD=${prodCount.toString().padStart(6)}, LOCAL=0`);
      } else if (prodCount > 0 && localCount < prodCount) {
        console.log(`  ${tableName.padEnd(40)} : PROD=${prodCount.toString().padStart(6)}, LOCAL=${localCount.toString().padStart(6)} (PROD has more)`);
      }
    }

  } catch (error) {
    console.error('Error during inspection:', error);
  } finally {
    await productionPrisma.$disconnect();
    await localPrisma.$disconnect();
    console.log('\n✓ Disconnected from both databases');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

