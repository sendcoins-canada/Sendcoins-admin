import { PrismaClient } from '@prisma/client';

/**
 * Script to copy all data from production database to local database
 * Handles foreign key constraints by copying tables in the correct order
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

// Tables to copy in order (respecting foreign key dependencies)
// Admin tables first (no dependencies)
const adminTables = [
  'Department',
  'Role',
  'RolePermission',
  'AdminUser',
  'AdminAuditLog',
];

// Production tables (may have dependencies)
const productionTables = [
  'send_coin_user',
  'merchants',
  'bank_list',
  'currency',
  'coin_network',
  'bank_account',
  'recipients',
  'transaction_history',
  'wallet_transfers',
  'user_notifications',
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
      return -1;
    }
  }
}

async function getAllRows(prisma: PrismaClient, tableName: string): Promise<any[]> {
  try {
    // Try with quotes first (PascalCase)
    let result = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${tableName}"`
    );
    return JSON.parse(JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )) || [];
  } catch (error: any) {
    // Try lowercase/snake_case
    try {
      const lowerName = tableName.toLowerCase();
      const result = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${lowerName}"`
      );
      return JSON.parse(JSON.stringify(result, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )) || [];
    } catch (e: any) {
      return [];
    }
  }
}

async function clearTable(prisma: PrismaClient, tableName: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
  } catch (error: any) {
    try {
      const lowerName = tableName.toLowerCase();
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${lowerName}" CASCADE`);
    } catch (e: any) {
      console.error(`  ⚠️  Could not clear ${tableName}: ${e.message}`);
    }
  }
}

async function insertRows(prisma: PrismaClient, tableName: string, rows: any[]): Promise<number> {
  if (rows.length === 0) return 0;

  // Insert in batches to avoid query size limits
  const batchSize = 100;
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    
    try {
      // Get column names from first row
      const columns = Object.keys(batch[0]);
      const columnList = columns.map(col => `"${col}"`).join(', ');
      
      // Build INSERT statements with proper escaping
      const values = batch.map(row => {
        const rowValues = columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'string') {
            // Escape single quotes and backslashes
            const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "''");
            return `'${escaped}'`;
          }
          if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
          if (typeof value === 'number') return value.toString();
          if (value instanceof Date) {
            return `'${value.toISOString()}'::timestamp`;
          }
          if (typeof value === 'object') {
            // Handle JSON/JSONB
            const jsonStr = JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "''");
            return `'${jsonStr}'::jsonb`;
          }
          return `'${String(value).replace(/'/g, "''")}'`;
        });
        return `(${rowValues.join(', ')})`;
      });

      const insertQuery = `
        INSERT INTO "${tableName}" (${columnList})
        VALUES ${values.join(', ')}
        ON CONFLICT DO NOTHING
      `;

      await prisma.$executeRawUnsafe(insertQuery);
      totalInserted += batch.length;
    } catch (error: any) {
      // Try lowercase table name
      try {
        const lowerName = tableName.toLowerCase();
        const columns = Object.keys(batch[0]);
        const columnList = columns.map(col => `"${col}"`).join(', ');
        
        const values = batch.map(row => {
          const rowValues = columns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) return 'NULL';
            if (typeof value === 'string') {
              const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "''");
              return `'${escaped}'`;
            }
            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
            if (typeof value === 'number') return value.toString();
            if (value instanceof Date) {
              return `'${value.toISOString()}'::timestamp`;
            }
            if (typeof value === 'object') {
              const jsonStr = JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "''");
              return `'${jsonStr}'::jsonb`;
            }
            return `'${String(value).replace(/'/g, "''")}'`;
          });
          return `(${rowValues.join(', ')})`;
        });

        const insertQuery = `
          INSERT INTO "${lowerName}" (${columnList})
          VALUES ${values.join(', ')}
          ON CONFLICT DO NOTHING
        `;

        await prisma.$executeRawUnsafe(insertQuery);
        totalInserted += batch.length;
      } catch (e: any) {
        console.error(`  ❌ Error inserting batch ${i}-${i + batch.length} into ${tableName}: ${e.message}`);
        // Continue with next batch
      }
    }
  }

  return totalInserted;
}

async function copyTable(tableName: string): Promise<void> {
  console.log(`\n📋 Copying ${tableName}...`);
  
  // Get row count from production
  const prodCount = await getTableCount(productionPrisma, tableName);
  if (prodCount <= 0) {
    console.log(`  ⏭️  Skipping ${tableName} (no data in production)`);
    return;
  }

  console.log(`  📊 Production has ${prodCount} rows`);

  // Get all rows from production
  const rows = await getAllRows(productionPrisma, tableName);
  console.log(`  📥 Fetched ${rows.length} rows from production`);

  if (rows.length === 0) {
    console.log(`  ⏭️  No rows to copy`);
    return;
  }

  // Clear local table
  console.log(`  🗑️  Clearing local ${tableName}...`);
  await clearTable(localPrisma, tableName);

  // Insert into local
  console.log(`  💾 Inserting ${rows.length} rows into local...`);
  const inserted = await insertRows(localPrisma, tableName, rows);
  console.log(`  ✅ Successfully copied ${inserted} rows`);
}

async function main() {
  console.log('🚀 Starting data copy from PRODUCTION to LOCAL...\n');
  console.log('='.repeat(80));

  try {
    // Test connections
    await productionPrisma.$queryRaw`SELECT 1`;
    console.log('✓ Connected to PRODUCTION');
    
    await localPrisma.$queryRaw`SELECT 1`;
    console.log('✓ Connected to LOCAL\n');

    // Copy admin tables first
    console.log('\n📦 Copying Admin Tables...');
    console.log('-'.repeat(80));
    for (const table of adminTables) {
      await copyTable(table);
    }

    // Copy production tables
    console.log('\n📦 Copying Production Tables...');
    console.log('-'.repeat(80));
    for (const table of productionTables) {
      await copyTable(table);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Data copy completed successfully!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error during copy:', error);
    process.exit(1);
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

