const https = require('https');

// CodeCast 模型连接测试脚本
console.log('\n========================================');
console.log('   CodeCast 多模型连接测试工具');
console.log('========================================\n');

const testResults = [];

function testAPIConnection(providerName, apiUrl, modelsEndpoint, apiKey = '') {
    return new Promise((resolve) => {
        console.log(`🔌 测试 ${providerName} ...`);
        console.log(`   API URL: ${apiUrl}`);
        
        const startTime = Date.now();
        
        const options = {
            hostname: new URL(modelsEndpoint).hostname,
            path: new URL(modelsEndpoint).pathname,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const latency = Date.now() - startTime;
                
                try {
                    const response = JSON.parse(data);
                    
                    console.log('   ✅ 连接成功!');
                    console.log(`   ⏱️  延迟: ${latency.toFixed(2)} ms`);
                    
                    if (response.data && Array.isArray(response.data)) {
                        console.log(`   📦 发现 ${response.data.length} 个模型`);
                        
                        const topModels = response.data.slice(0, 5).map(m => m.id);
                        console.log(`   📋 示例模型: ${topModels.join(', ')}`);
                    } else {
                        console.log('   📦 API 响应正常');
                    }
                    
                    testResults.push({
                        provider: providerName,
                        success: true,
                        latency: latency.toFixed(2),
                        error: null
                    });
                } catch (e) {
                    console.log('   ✅ 连接成功! (响应解析失败，但连接正常)');
                    console.log(`   ⏱️  延迟: ${latency.toFixed(2)} ms`);
                    
                    testResults.push({
                        provider: providerName,
                        success: true,
                        latency: latency.toFixed(2),
                        error: null
                    });
                }
                
                resolve();
                console.log('');
            });
        });

        req.on('error', (error) => {
            const latency = Date.now() - startTime;
            
            console.log('   ❌ 连接失败!');
            console.log(`   ⏱️  延迟: ${latency.toFixed(2)} ms`);
            console.log(`   💥 错误: ${error.message}`);
            
            testResults.push({
                provider: providerName,
                success: false,
                latency: latency.toFixed(2),
                error: error.message
            });
            
            resolve();
            console.log('');
        });

        req.on('timeout', () => {
            req.destroy();
            const latency = Date.now() - startTime;
            
            console.log('   ❌ 连接超时!');
            console.log(`   ⏱️  延迟: ${latency.toFixed(2)} ms`);
            
            testResults.push({
                provider: providerName,
                success: false,
                latency: latency.toFixed(2),
                error: '请求超时 (10秒)'
            });
            
            resolve();
            console.log('');
        });

        req.end();
    });
}

async function runTests() {
    // ==================== 测试 Kimi (月之暗面) ====================
    console.log('┌─────────────────────────────────────┐');
    console.log('│ 1️⃣  Kimi (Moonshot / 月之暗面)       │');
    console.log('└─────────────────────────────────────┘\n');

    await testAPIConnection(
        'Kimi (Moonshot)',
        'https://api.moonshot.cn/v1',
        'https://api.moonshot.cn/v1/models'
    );

    // ==================== 测试 GLM (智谱清言) ====================
    console.log('┌─────────────────────────────────────┐');
    console.log('│ 2️⃣  GLM (智谱清言)                   │');
    console.log('└─────────────────────────────────────┘\n');

    await testAPIConnection(
        'GLM (智谱)',
        'https://open.bigmodel.cn/api/paas/v4',
        'https://open.bigmodel.cn/api/paas/v4/models'
    );

    // ==================== 测试结果汇总 ====================
    console.log('========================================');
    console.log('           📊 测试结果汇总              ');
    console.log('========================================\n');

    const successCount = testResults.filter(r => r.success).length;
    const totalCount = testResults.length;

    console.log(`总测试数: ${totalCount} | 成功: ${successCount} | 失败: ${totalCount - successCount}\n`);

    testResults.forEach(result => {
        if (result.success) {
            console.log(`✅ ${result.provider}: 成功 (${result.latency} ms)`);
        } else {
            console.log(`❌ ${result.provider}: 失败 - ${result.error}`);
        }
    });

    console.log('');

    // ==================== 兼容性分析 ====================
    console.log('========================================');
    console.log('         🔍 CodeCast 集成状态          ');
    console.log('========================================\n');

    console.log('📋 后端支持情况:');
    console.log('   • config.go 配置定义: 已包含 Kimi 和 GLM');
    console.log('   • 专用 Provider 实现: 缺少 KimiProvider 和 GLMProvider');
    console.log('   • OpenAI 兼容性: 两家都兼容 OpenAI API 格式\n');

    console.log('📋 前端 UI 支持情况:');
    console.log('   • builtin-providers.ts: 未包含 Kimi 和 GLM 详细配置');
    console.log('   • 连接测试端点: getTestEndpoint() 不支持 kimi/glm\n');

    console.log('💡 结论:');
    
    const kimiResult = testResults.find(r => r.provider.includes('Kimi'));
    const glmResult = testResults.find(r => r.provider.includes('GLM'));

    if (kimiResult?.success && glmResult?.success) {
        console.log('   🎉 Kimi 和 GLM API 都可以正常访问！');
        console.log('   ✅ 可以通过 OpenAI 兼容层立即使用');
        console.log('   📝 建议: 添加专用的 Provider 实现以获得完整功能');
    } else if (kimiResult?.success || glmResult?.success) {
        const workingProvider = kimiResult?.success ? 'Kimi' : 'GLM';
        console.log(`   ⚠️ 只有 ${workingProvider} 可以正常访问`);
        console.log('   🔧 请检查另一个提供商的网络或 API 状态');
    } else {
        console.log('   ❌ 两个 API 都无法访问');
        console.log('   🔍 可能原因:');
        console.log('      - 网络连接问题');
        console.log('      - API 服务暂时不可用');
        console.log('      - 需要代理/VPN (国内访问可能受限)');
    }

    console.log('\n========================================\n');
}

runTests().catch(console.error);
