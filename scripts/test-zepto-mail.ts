/**
 * ZeptoMail Diagnostic Test Script
 *
 * Run with: npx ts-node scripts/test-zepto-mail.ts
 * Or: npx tsx scripts/test-zepto-mail.ts
 */

import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const config = {
  host: process.env.ZEPTO_HOST ?? 'smtp.zeptomail.com',
  port: Number(process.env.ZEPTO_PORT ?? 587),
  user: process.env.ZEPTO_USER,
  pass: process.env.ZEPTO_API_KEY,
  from: process.env.MAIL_FROM,
};

console.log('='.repeat(60));
console.log('ZeptoMail Diagnostic Test');
console.log('='.repeat(60));

// Check configuration
console.log('\n1. Configuration Check:');
console.log(`   Host: ${config.host}`);
console.log(`   Port: ${config.port}`);
console.log(`   User: ${config.user ? config.user : '❌ MISSING'}`);
console.log(`   API Key: ${config.pass ? `${config.pass.substring(0, 10)}...` : '❌ MISSING'}`);
console.log(`   From: ${config.from ? config.from : '❌ MISSING'}`);

if (!config.user || !config.pass || !config.from) {
  console.log('\n❌ Missing required configuration. Check your .env file.');
  process.exit(1);
}

async function testConnection() {
  console.log('\n2. Testing SMTP Connection...');

  // Test with different secure/TLS configurations
  const configurations = [
    { name: 'STARTTLS (port 587)', secure: false, requireTLS: true },
    { name: 'Auto TLS', secure: false, requireTLS: false },
    { name: 'SSL (port 465 style)', secure: true, requireTLS: false },
  ];

  for (const cfg of configurations) {
    console.log(`\n   Testing: ${cfg.name}`);

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: cfg.secure,
      requireTLS: cfg.requireTLS,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      debug: true,
      logger: false,
    });

    try {
      const result = await transporter.verify();
      console.log(`   ✅ Connection successful: ${result}`);
      return { transporter, configName: cfg.name };
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      if (error.code) console.log(`      Code: ${error.code}`);
      if (error.response) console.log(`      Response: ${error.response}`);
    }
  }

  return null;
}

async function testSendEmail(transporter: nodemailer.Transporter, testEmail: string) {
  console.log(`\n3. Sending Test Email to: ${testEmail}`);

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: testEmail,
      subject: 'ZeptoMail Test - ' + new Date().toISOString(),
      text: `This is a test email sent at ${new Date().toISOString()}\n\nIf you receive this, ZeptoMail is working correctly.`,
      html: `
        <h2>ZeptoMail Test</h2>
        <p>This is a test email sent at <strong>${new Date().toISOString()}</strong></p>
        <p>If you receive this, ZeptoMail is working correctly.</p>
      `,
    });

    console.log('   ✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    return true;
  } catch (error: any) {
    console.log(`   ❌ Failed to send email`);
    console.log(`   Error: ${error.message}`);
    if (error.code) console.log(`   Code: ${error.code}`);
    if (error.response) console.log(`   Response: ${error.response}`);
    if (error.responseCode) console.log(`   Response Code: ${error.responseCode}`);

    // Common error explanations
    if (error.message.includes('Invalid login')) {
      console.log('\n   💡 Hint: Check your ZEPTO_USER and ZEPTO_API_KEY');
    }
    if (error.message.includes('sender') || error.message.includes('from')) {
      console.log('\n   💡 Hint: The sender domain may not be verified in ZeptoMail');
      console.log('      Go to ZeptoMail dashboard > Mail Agents > Verify your domain');
    }
    if (error.message.includes('authentication')) {
      console.log('\n   💡 Hint: Authentication failed. Verify:');
      console.log('      - ZEPTO_USER should be "emailapikey" for ZeptoMail');
      console.log('      - ZEPTO_API_KEY should be the Send Mail Token from ZeptoMail');
    }

    return false;
  }
}

async function testWithZeptoAPI() {
  console.log('\n4. Testing ZeptoMail API directly (alternative method)...');

  // ZeptoMail also supports a REST API - let's test that too
  const apiKey = config.pass;
  const endpoint = 'https://api.zeptomail.com/v1.1/email';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Zoho-encrtoken ${apiKey}`,
      },
      body: JSON.stringify({
        from: { address: 'noreply@sendcoins.ca', name: 'Sendcoins' },
        to: [{ email_address: { address: 'test@example.com', name: 'Test' } }],
        subject: 'API Test',
        textbody: 'Test email via API',
      }),
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      if (data.error?.details?.includes('sender')) {
        console.log('\n   💡 Hint: Sender domain not verified. Verify sendcoins.ca in ZeptoMail.');
      }
    }
  } catch (error: any) {
    console.log(`   API test error: ${error.message}`);
  }
}

async function main() {
  // Get test email from command line or use a default
  const testEmail = process.argv[2] || 'test@example.com';

  if (process.argv[2]) {
    console.log(`\nTest email will be sent to: ${testEmail}`);
  } else {
    console.log('\nNo test email provided. Run with: npx tsx scripts/test-zepto-mail.ts your@email.com');
  }

  // Test SMTP connection
  const connectionResult = await testConnection();

  if (connectionResult && process.argv[2]) {
    // Only send test email if a real email address was provided
    await testSendEmail(connectionResult.transporter, testEmail);
  }

  // Test API method
  await testWithZeptoAPI();

  console.log('\n' + '='.repeat(60));
  console.log('Diagnostic Complete');
  console.log('='.repeat(60));

  console.log('\nCommon ZeptoMail Issues:');
  console.log('1. Domain not verified - Verify sendcoins.ca in ZeptoMail dashboard');
  console.log('2. Wrong API key - Use "Send Mail Token" not "API Token"');
  console.log('3. Wrong port - Try port 465 with secure:true');
  console.log('4. Firewall - Ensure outbound SMTP (587/465) is allowed');
  console.log('5. Rate limit - Check if you hit sending limits');
}

main().catch(console.error);
