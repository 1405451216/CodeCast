@echo off
chcp 65001 >nul
echo ============================================
echo   CodeCast GitLink 快速配置工具
echo ============================================
echo.

REM 检查 git 是否安装
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 git，请先安装 Git
    pause
    exit /b 1
)

echo [1/4] 检查远程仓库...
git remote -v | findstr "gitlink" >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] GitLink 远程仓库已存在
) else (
    echo [!] 未找到 GitLink 远程仓库
    set /p GITEE_URL="请输入你的 GitLink 仓库地址 (如 https://gitlink.org.cn/username/codecast.git): "
    if not "%GITEE_URL%"=="" (
        git remote add gitlink %GITEE_URL%
        echo [✓] 已添加 GitLink 远程仓库
    )
)

echo.
echo [2/4] 同步代码到 GitLink...
git push gitlink main --tags
if %errorlevel% equ 0 (
    echo [✓] 代码已推送到 GitLink
) else (
    echo [✗] 推送失败，请检查网络连接和权限
    pause
    exit /b 1
)

echo.
echo [3/4] 当前 GitLink CI 配置文件:
if exist ".gitlink-ci.yml" (
    echo [✓] .gitlink-ci.yml 存在
    type .gitlink-ci.yml | findstr /n "." | findstr "^[1-9]:"
) else (
    echo [✗] .gitlink-ci.yml 不存在！
)

echo.
echo [4/4] 下一步操作指南:
echo -------------------------------------------
echo 1. 打开浏览器访问: https://gitlink.org.cn
echo 2. 进入你的 CodeCast 项目
echo 3. 点击 "DevOps" 或 "引擎" 菜单
echo 4. 开启 Trustie DevOps 引擎
echo 5. 系统会自动读取 .gitlink-ci.yml 配置
echo 6. 点击 "运行流水线" 开始构建
echo -------------------------------------------
echo.
echo 🎉 配置完成！请在 GitLink 网页端完成后续操作
echo.

pause
