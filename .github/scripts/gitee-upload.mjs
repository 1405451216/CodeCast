import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const GITEE_TOKEN = process.env.GITEE_TOKEN;
const GITEE_OWNER = process.env.GITEE_OWNER || 'CodeCast';
const GITEE_REPO = process.env.GITEE_REPO_NAME || 'code-cast';
const TAG = process.env.TAG || 'v0.2.0';
const FILES_DIR = process.env.FILES_DIR || './dist';

if (!GITEE_TOKEN) {
  console.error('❌ GITEE_TOKEN 环境变量未设置');
  process.exit(1);
}

const API_BASE = `https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}`;
const headers = { 'Content-Type': 'application/json' };

async function request(method, url, data = null, options = {}) {
  const config = { method, url, headers: { ...headers, ...options.headers }, ...options };
  if (data) config.data = data;
  try {
    const resp = await axios(config);
    return resp.data;
  } catch (err) {
    if (err.response) {
      const msg = err.response.data?.message || JSON.stringify(err.response.data);
      throw new Error(`HTTP ${err.response.status}: ${msg}`);
    }
    throw err;
  }
}

async function getOrCreateRelease() {
  console.log(`\n📦 查找/创建 Release: ${TAG}`);

  try {
    const release = await request('get', `${API_BASE}/releases/tags/${TAG}?access_token=${GITEE_TOKEN}`);
    console.log(`  ✅ 找到已有 Release ID=${release.id}`);
    return release;
  } catch {
    console.log(`  Release 不存在，创建新的...`);
  }

  const body = {
    access_token: GITEE_TOKEN,
    tag_name: TAG,
    name: `CodeCast ${TAG}`,
    body: [
      `## CodeCast ${TAG}`,
      '',
      '🚀 Windows 版本',
      '',
      '从 GitHub Actions 自动构建并同步发布',
    ].join('\n'),
    prerelease: false,
  };

  try {
    const release = await request('post', `${API_BASE}/releases`, body);
    console.log(`  ✅ Release 创建成功 ID=${release.id}`);
    return release;
  } catch (err) {
    console.error(`  ❌ Release 创建失败: ${err.message}`);
    throw err;
  }
}

async function uploadAttachment(releaseId, filePath) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  console.log(`  📤 上传: ${fileName} (${formatSize(fileSize)})`);

  const form = new FormData();
  form.append('access_token', GITEE_TOKEN);
  form.append('file', fs.createReadStream(filePath), {
    filename: fileName,
    contentType: 'application/octet-stream',
  });

  try {
    const resp = await axios.post(
      `${API_BASE}/releases/${releaseId}/attach_files`,
      form,
      {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { ...form.getHeaders() },
        timeout: 120000,
      }
    );

    const data = resp.data;
    if (data.id || data.attach_file_id) {
      console.log(`  ✅ ${fileName} 上传成功`);
      return true;
    }
    console.log(`  ⚠️ ${fileName} 响应异常: ${JSON.stringify(data).slice(0, 200)}`);
    return false;
  } catch (err) {
    const msg = err.response?.data
      ? (typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data).slice(0, 300))
      : err.message;
    console.error(`  ❌ ${fileName} 上传失败: ${msg}`);
    return false;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

async function main() {
  console.log('========================================');
  console.log('🚀 Gitee Release 同步工具');
  console.log(`   仓库: ${GITEE_OWNER}/${GITEE_REPO}`);
  console.log(`   版本: ${TAG}`);
  console.log('========================================');

  let release;
  try {
    release = await getOrCreateRelease();
  } catch (err) {
    console.error(`\n❌ 无法获取/创建 Release，退出`);
    process.exit(2);
  }

  const files = fs.readdirSync(FILES_DIR).filter(f => {
    const fp = path.join(FILES_DIR, f);
    return fs.statSync(fp).isFile();
  });

  if (files.length === 0) {
    console.warn('\n⚠️ 没有找到需要上传的文件');
    process.exit(0);
  }

  console.log(`\n📁 发现 ${files.length} 个文件待上传:`);
  files.forEach(f => console.log(`   - ${f}`));

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const filePath = path.join(FILES_DIR, file);
    const ok = await uploadAttachment(release.id, filePath);
    if (ok) successCount++; else failCount++;
    // 避免触发 Gitee API 速率限制
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n========================================');
  if (failCount === 0) {
    console.log('✅ 全部上传完成！');
  } else {
    console.log(`⚠️ 完成: ${successCount} 成功, ${failCount} 失败`);
  }
  console.log(`🔗 下载地址: https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/tag/${TAG}`);
  console.log('========================================');

  process.exit(failCount > 0 ? 2 : 0);
}

main().catch(err => {
  console.error(`\n💥 未预期的错误: ${err.message}`);
  process.exit(1);
});
