# CodeCast 模型连接测试脚本
# 测试 Kimi (月之暗面) 和 GLM (智谱) API 可用性

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CodeCast 多模型连接测试工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testResults = @()

function Test-APIConnection {
    param(
        [string]$ProviderName,
        [string]$APIUrl,
        [string]$ModelsEndpoint,
        [string]$APIKey = ""
    )

    Write-Host "🔌 测试 $ProviderName ..." -ForegroundColor Yellow
    Write-Host "   API URL: $APIUrl"
    
    $startTime = Get-Date
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($APIKey) {
            $headers["Authorization"] = "Bearer $APIKey"
        }

        $response = Invoke-RestMethod -Uri $ModelsEndpoint -Method GET -Headers $headers -TimeoutSec 10
        
        $endTime = Get-Date
        $latency = ($endTime - $startTime).TotalMilliseconds
        
        Write-Host "   ✅ 连接成功!" -ForegroundColor Green
        $latencyRounded = [math]::Round($latency, 2)
        Write-Host "   ⏱️  延迟: $latencyRounded ms"
        
        if ($response.data) {
            $modelCount = @($response.data).Count
            Write-Host "   📦 发现 $modelCount 个模型"
            
            $topModels = $response.data | Select-Object -First 5 | ForEach-Object { $_.id }
            $modelsStr = $topModels -join ", "
            Write-Host "   � 示例模型: $modelsStr"
        } else {
            Write-Host "   📦 API 响应正常"
        }

        return @{
            Provider = $ProviderName
            Success = $true
            Latency = $latencyRounded
            Error = $null
        }
    }
    catch {
        $endTime = Get-Date
        $latency = ($endTime - $startTime).TotalMilliseconds
        $errorMsg = $_.Exception.Message
        $latencyRounded = [math]::Round($latency, 2)
        
        Write-Host "   ❌ 连接失败!" -ForegroundColor Red
        Write-Host "   ⏱️  延迟: $latencyRounded ms"
        Write-Host "   💥 错误: $errorMsg"

        return @{
            Provider = $ProviderName
            Success = $false
            Latency = $latencyRounded
            Error = $errorMsg
        }
    }
    finally {
        Write-Host ""
    }
}

# ==================== 测试 Kimi (月之暗面) ====================
Write-Host "┌─────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "│ 1️⃣  Kimi (Moonshot / 月之暗面)       │" -ForegroundColor DarkGray
Write-Host "└─────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""

$kimiResult = Test-APIConnection -ProviderName "Kimi (Moonshot)" `
                                  -APIUrl "https://api.moonshot.cn/v1" `
                                  -ModelsEndpoint "https://api.moonshot.cn/v1/models"

$testResults += $kimiResult

# ==================== 测试 GLM (智谱清言) ====================
Write-Host "┌─────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "│ 2️⃣  GLM (智谱清言)                   │" -ForegroundColor DarkGray
Write-Host "└─────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""

$glmResult = Test-APIConnection -ProviderName "GLM (智谱)" `
                                 -APIUrl "https://open.bigmodel.cn/api/paas/v4" `
                                 -ModelsEndpoint "https://open.bigmodel.cn/api/paas/v4/models"

$testResults += $glmResult

# ==================== 测试结果汇总 ====================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "           📊 测试结果汇总              " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$successCount = ($testResults | Where-Object { $_.Success -eq $true }).Count
$totalCount = $testResults.Count

Write-Host "总测试数: $totalCount | 成功: $successCount | 失败: $($totalCount - $successCount)" -ForegroundColor White
Write-Host ""

foreach ($result in $testResults) {
    if ($result.Success) {
        Write-Host "✅ $($result.Provider): 成功 ($($result.Latency) ms)" -ForegroundColor Green
    } else {
        Write-Host "❌ $($result.Provider): 失败 - $($result.Error)" -ForegroundColor Red
    }
}

Write-Host ""

# ==================== 兼容性分析 ====================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         🔍 CodeCast 集成状态          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 后端支持情况:" -ForegroundColor Yellow
Write-Host "   • config.go 配置定义: 已包含 Kimi 和 GLM" -ForegroundColor Green
Write-Host "   • 专用 Provider 实现: 缺少 KimiProvider 和 GLMProvider" -ForegroundColor Red
Write-Host "   • OpenAI 兼容性: 两家都兼容 OpenAI API 格式" -ForegroundColor Green

Write-Host ""
Write-Host "📋 前端 UI 支持情况:" -ForegroundColor Yellow
Write-Host "   • builtin-providers.ts: 未包含 Kimi 和 GLM 详细配置" -ForegroundColor Yellow
Write-Host "   • 连接测试端点: getTestEndpoint() 不支持 kimi/glm" -ForegroundColor Red

Write-Host ""
Write-Host "💡 结论:" -ForegroundColor Magenta
if ($kimiResult.Success -and $glmResult.Success) {
    Write-Host "   🎉 Kimi 和 GLM API 都可以正常访问！" -ForegroundColor Green
    Write-Host "   ✅ 可以通过 OpenAI 兼容层立即使用" -ForegroundColor Green
    Write-Host "   📝 建议: 添加专用的 Provider 实现以获得完整功能" -ForegroundColor Yellow
} elseif ($kimiResult.Success -xor $glmResult.Success) {
    if ($kimiResult.Success) {
        $workingProvider = "Kimi"
    } else {
        $workingProvider = "GLM"
    }
    Write-Host "   ⚠️ 只有 $workingProvider 可以正常访问" -ForegroundColor Yellow
    Write-Host "   🔧 请检查另一个提供商的网络或 API 状态" -ForegroundColor Yellow
} else {
    Write-Host "   ❌ 两个 API 都无法访问" -ForegroundColor Red
    Write-Host "   🔍 可能原因:" -ForegroundColor Red
    Write-Host "      - 网络连接问题" -ForegroundColor Gray
    Write-Host "      - API 服务暂时不可用" -ForegroundColor Gray
    Write-Host "      - 需要代理/VPN (国内访问可能受限)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
