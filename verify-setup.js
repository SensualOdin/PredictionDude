#!/usr/bin/env node

/**
 * Verification script for Project Oracle setup
 * Run with: node verify-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verifying Project Oracle Setup...\n');

let errors = 0;
let warnings = 0;

// Check required files
const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'next.config.ts',
  'tailwind.config.ts',
  '.env.local',
  'app/page.tsx',
  'app/layout.tsx',
  'app/api/predict/route.ts',
  'components/ImageUpload.tsx',
  'components/InputForm.tsx',
  'components/MoneySlider.tsx',
  'components/PredictionResults.tsx',
  'lib/store.ts',
  'lib/systemPrompt.ts',
  'lib/types.ts',
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    errors++;
  }
});

// Check node_modules
console.log('\n📦 Checking dependencies...');
if (fs.existsSync('node_modules')) {
  console.log('  ✅ node_modules folder exists');

  const requiredPackages = [
    '@google/generative-ai',
    'next',
    'react',
    'react-dom',
    'zustand',
    'tailwindcss',
  ];

  requiredPackages.forEach(pkg => {
    const pkgPath = path.join('node_modules', pkg);
    if (fs.existsSync(pkgPath)) {
      console.log(`  ✅ ${pkg}`);
    } else {
      console.log(`  ❌ ${pkg} - NOT INSTALLED`);
      errors++;
    }
  });
} else {
  console.log('  ❌ node_modules not found - Run: npm install');
  errors++;
}

// Check .env.local
console.log('\n🔑 Checking environment variables...');
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');

  if (envContent.includes('GOOGLE_GENERATIVE_AI_API_KEY')) {
    if (envContent.includes('your_api_key_here')) {
      console.log('  ⚠️  API key not configured - Update .env.local');
      warnings++;
    } else if (envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=AIza[A-Za-z0-9_-]+/)) {
      console.log('  ✅ API key configured');
    } else {
      console.log('  ⚠️  API key format looks incorrect');
      warnings++;
    }
  } else {
    console.log('  ❌ GOOGLE_GENERATIVE_AI_API_KEY not found in .env.local');
    errors++;
  }
} else {
  console.log('  ❌ .env.local not found');
  errors++;
}

// Check package.json scripts
console.log('\n📜 Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredScripts = ['dev', 'build', 'start'];

requiredScripts.forEach(script => {
  if (packageJson.scripts && packageJson.scripts[script]) {
    console.log(`  ✅ npm run ${script}`);
  } else {
    console.log(`  ❌ npm run ${script} - NOT FOUND`);
    errors++;
  }
});

// Summary
console.log('\n' + '='.repeat(50));
if (errors === 0 && warnings === 0) {
  console.log('✅ Setup verification complete - No issues found!');
  console.log('\n🚀 Ready to start:');
  console.log('   npm run dev');
} else {
  console.log(`⚠️  Setup verification complete with issues:`);
  if (errors > 0) {
    console.log(`   ❌ ${errors} error(s) - Must fix before running`);
  }
  if (warnings > 0) {
    console.log(`   ⚠️  ${warnings} warning(s) - Should address`);
  }
  console.log('\n📖 See SETUP.md for detailed instructions');
}
console.log('='.repeat(50) + '\n');

process.exit(errors > 0 ? 1 : 0);
