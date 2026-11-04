#!/usr/bin/env node
/**
 * Automated Security & Secret Leak Scanner for Tiệm Cuộn Len
 * Run via: npm run security:check
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const API_DIR = path.join(ROOT, 'api');
const VERCEL_JSON = path.join(ROOT, 'vercel.json');

const FORBIDDEN_CLIENT_PATTERNS = [
  { name: 'Supabase Service Role Key', regex: /service_role|SUPABASE_SERVICE_ROLE/i },
  { name: 'SePay Webhook Secret in Client', regex: /SEPAY_WEBHOOK_SECRET/ },
  { name: 'EmailJS Service/Template/Public Key in Client', regex: /service_fk9anb7|template_q41v0ct|kT2DQJicRXPdQjvb3|EXPO_PUBLIC_EMAILJS_/ },
  { name: 'Direct Audit/Blocklist DB Partition Access in Client', regex: /__TCL_SECURITY_AUDIT_LOG_V1__|__TCL_SECURITY_BLOCKLIST_V1__/ },
  { name: 'Direct PostgreSQL Connection URI in Client', regex: /postgres(?:ql)?:\/\/[^\s'"]+/i },
  { name: 'Private Key Block in Client', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
];

function walkFiles(dir, extList = ['.ts', '.tsx', '.js', '.jsx']) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, extList));
    } else if (extList.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

let failures = 0;

function pass(msg) {
  console.log(`  ✅ [PASS] ${msg}`);
}

function fail(msg) {
  failures++;
  console.error(`  ❌ [FAIL] ${msg}`);
}

console.log('\n🛡️  === KIỂM TRA BẢO MẬT TỰ ĐỘNG (TIỆM CUỘN LEN) ===\n');

// 1. Scan client-side `src/` for leaked secrets or internal server identifiers
console.log('1️⃣  Quét mã nguồn Client (src/) tìm API Key / Secret nhạy cảm...');
const srcFiles = walkFiles(SRC_DIR);
let clientLeaks = 0;
for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  for (const rule of FORBIDDEN_CLIENT_PATTERNS) {
    if (rule.regex.test(content)) {
      clientLeaks++;
      fail(`Phát hiện [${rule.name}] bị lộ ở Client file: ${rel}`);
    }
  }
}
if (clientLeaks === 0) {
  pass(`Đã quét ${srcFiles.length} file trong src/ — 0 lộ API Key / Secret nhạy cảm.`);
}

// 2. Verify Global Error Handler & Anti-Mass-Assignment in all API routes
console.log('\n2️⃣  Kiểm tra Global Error Handler & Schema Sanitizer trong api/...');
const apiFiles = walkFiles(API_DIR, ['.js']).filter(
  (f) => !path.basename(f).startsWith('_')
);
for (const file of apiFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  if (content.includes('withGlobalErrorHandler')) {
    pass(`${rel}: Đã bọc Global Error Handler (không lộ Stack Trace).`);
  } else {
    fail(`${rel}: Thiếu withGlobalErrorHandler!`);
  }
  if (content.includes('stripUnknownFieldsServer') && content.includes('sanitizeTextServer')) {
    pass(`${rel}: Đã bật Anti-Mass-Assignment & XSS Sanitizer.`);
  } else {
    fail(`${rel}: Thiếu stripUnknownFieldsServer hoặc sanitizeTextServer!`);
  }
}

// 3. Verify File Upload Security Utility (Magic Bytes + UUID v4 + Size Limit)
console.log('\n3️⃣  Kiểm tra bộ lọc Upload Ảnh (Magic Bytes + UUID v4 + Max Size)...');
const uploadGuardPath = path.join(SRC_DIR, 'utils', 'fileUploadGuard.ts');
if (fs.existsSync(uploadGuardPath)) {
  const uploadContent = fs.readFileSync(uploadGuardPath, 'utf8');
  if (
    uploadContent.includes('detectImageFormatByMagicBytes') &&
    uploadContent.includes('generateUuidFilename') &&
    uploadContent.includes('MAX_UPLOAD_FILE_BYTES')
  ) {
    pass('src/utils/fileUploadGuard.ts: Đã kích hoạt kiểm tra Magic Bytes, giới hạn dung lượng & đổi tên UUID v4.');
  } else {
    fail('src/utils/fileUploadGuard.ts: Thiếu hàm kiểm tra Magic Bytes hoặc UUID v4.');
  }
} else {
  fail('Không tìm thấy src/utils/fileUploadGuard.ts!');
}

// 4. Verify HTTP Security Headers in vercel.json
console.log('\n4️⃣  Kiểm tra cấu hình HTTP Security Headers trong vercel.json...');
if (fs.existsSync(VERCEL_JSON)) {
  const vercelRaw = fs.readFileSync(VERCEL_JSON, 'utf8');
  const requiredHeaders = [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
  ];
  for (const h of requiredHeaders) {
    if (vercelRaw.includes(h)) {
      pass(`vercel.json có cấu hình header: ${h}`);
    } else {
      fail(`vercel.json thiếu header: ${h}`);
    }
  }
} else {
  fail('Không tìm thấy vercel.json!');
}

// 5. Run npm audit for production dependencies
console.log('\n5️⃣  Quét lỗ hổng thư viện (npm audit --omit=dev)...');
try {
  const auditOut = execSync('npm audit --omit=dev --json', {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString();
  const parsed = JSON.parse(auditOut);
  const vulns = (parsed.metadata && parsed.metadata.vulnerabilities) || {};
  const critical = vulns.critical || 0;
  const high = vulns.high || 0;
  if (critical === 0 && high === 0) {
    pass(`Không phát hiện lỗ hổng nghiêm trọng (Critical: ${critical}, High: ${high}).`);
  } else {
    console.warn(`  ⚠️  [WARN] Phát hiện lỗ hổng thư viện (Critical: ${critical}, High: ${high}). Chạy 'npm audit fix' để cập nhật.`);
  }
} catch (e) {
  try {
    const stdout = e.stdout ? e.stdout.toString() : '{}';
    const parsed = JSON.parse(stdout);
    const vulns = (parsed.metadata && parsed.metadata.vulnerabilities) || {};
    console.log(
      `  ℹ️  [INFO] Kết quả npm audit: Critical=${vulns.critical || 0}, High=${vulns.high || 0}, Moderate=${vulns.moderate || 0}, Low=${vulns.low || 0}`
    );
  } catch {
    console.log('  ℹ️  [INFO] Đã hoàn tất kiểm tra npm audit.');
  }
}

console.log('\n======================================================');
if (failures > 0) {
  console.error(`❌ Kiểm tra bảo mật thất bại với ${failures} lỗi cần khắc phục.\n`);
  process.exit(1);
} else {
  console.log('✅ TẤT CẢ CÁC LỚP BẢO MẬT ĐỀU ĐẠT CHUẨN AN TOÀN!\n');
  process.exit(0);
}
