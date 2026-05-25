# CodeCast PWA Icons

此目录包含 PWA (Progressive Web App) 所需的图标文件。

## 图标尺寸要求

| 文件名 | 尺寸 | 用途 |
|--------|------|------|
| icon-72x72.png | 72×72 | Android 自适应图标 (小) |
| icon-96x96.png | 96×96 | Android 自适应图标 (中) |
| icon-128x128.png | 128×128 | Chrome Web Store |
| icon-144x144.png | 144×144 | Windows Tile |
| icon-152x152.png | 152×152 | iOS iPad |
| icon-192x192.png | 192×192 | Apple Touch Icon / PWA |
| icon-384x384.png | 384×384 | iPad Pro Retina |
| icon-512x512.png | 512×512 | Android 自适应图标 (大) |

## 生成真实图标的工具

推荐使用以下在线工具从 SVG 生成 PNG：

1. **[RealFaviconGenerator](https://realfavicongenerator.net/)**
   - 上传 `icon-512x512.svg`
   - 自动生成所有所需尺寸
   - 包含 iOS 和 Android 配置

2. **[PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)**
   - Microsoft 官方工具
   - 支持批量生成
   - 自动优化

3. **命令行工具 (可选)**:
```bash
# 使用 sharp (Node.js)
npm install -g sharp
sharp public/icons/icon-512x512.svg -o public/icons/icon-192x192.png resize 192 192
sharp public/icons/icon-512x512.svg -o public/icons/icon-512x512.png resize 512 512
```

## 当前状态

✅ 已提供: SVG 格式图标 (用于开发和测试)
⏳ 待生成: PNG 格式图标 (用于生产环境)

## 注意事项

- 所有图标应为 **maskable** (可遮罩) 格式
- 建议使用 **安全区域** 设计，重要内容在中心 80% 区域内
- 背景色应与 manifest.json 中的 `background_color` 一致 (#1a1a2e)
