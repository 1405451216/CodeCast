import axios from 'axios';
import fs from 'fs';
import path from 'path';

const DOWNLOAD_DIR = './dist';
const TAG = 'v0.2.0';
const REPO = 'CodeCast/CodeCast'; // 需要确认
const BASE_URL = `https://github.com/${REPO}/releases/download/${TAG}`;

const FILES = [
  'CodeCast.exe',
  'CodeCast-Windows-portable.zip',
];

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function downloadFile(url, destPath) {
  const fileName = path.basename(destPath);
  console.log(`⬇️  下载: ${fileName}`);
  
  const writer = fs.createWriteStream(destPath);
  
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 300000, // 5分钟超时
  });

  const total = parseInt(response.headers['content-length'], 10);
  let downloaded = 0;

  response.data.on('data', (chunk) => {
    downloaded += chunk.length;
    process.stdout.write(`\r   进度: ${formatSize(downloaded)} / ${formatSize(total)} (${Math.round(downloaded/total*100)}%)`);
  });

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', () => {
      console.log(`\n   ✅ ${fileName} 完成 (${formatSize(fs.statSync(destPath).size)})`);
      resolve();
    });
    writer.on('error', reject);
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

async function main() {
  console.log('========================================');
  console.log(`📥 从 GitHub Release ${TAG} 下载构建产物`);
  console.log(`   仓库: ${REPO}`);
  console.log('========================================\n');

  for (const file of FILES) {
    const url = `${BASE_URL}/${file}`;
    const destPath = path.join(DOWNLOAD_DIR, file);
    
    try {
      await downloadFile(url, destPath);
    } catch (err) {
      if (err.response?.status === 404) {
        console.error(`\n   ❌ 文件不存在 (404): ${file}`);
        console.error(`      URL: ${url}`);
      } else {
        console.error(`\n   ❌ 下载失败: ${err.message}`);
      }
      process.exit(1);
    }
    
    // 稍作延迟
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n========================================');
  console.log('✅ 全部下载完成！');
  console.log(`📁 目录: ${path.resolve(DOWNLOAD_DIR)}`);
  console.log('========================================');
}

main().catch(err => {
  console.error('\n💥 错误:', err.message);
  process.exit(1);
});
