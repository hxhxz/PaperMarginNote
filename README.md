# PaperMarginNote

PaperMarginNote 是一款运行在 Chrome 原生 PDF 阅读器旁的论文阅读辅助扩展。它不会替换浏览器内置的 PDF 阅读体验，而是通过 Side Panel 提供论文问答、选文翻译、引用追踪、外部知识检索，以及可持续维护的 Markdown 学习笔记。

## 功能特性

- 在 Chrome PDF 阅读器旁打开约 400px 宽的论文问答侧边栏。
- 选中 PDF 原文后，通过右键菜单翻译、解释或引用提问。
- 尝试将引用内容定位到对应页码和章节，并明确展示定位状态。
- 支持“论文优先”和“外部知识”两种单次提问模式。
- 支持 OpenAI API 及 OpenAI 兼容接口，可自定义 Base URL 和模型。
- 结束一次学习后，将对话、结论与引用合并为 Markdown 知识文档。
- 支持知识文档编辑、自动保存、版本比较、恢复和 `.md` 下载。
- API Key 仅保存在本机的 `chrome.storage.local` 中。

## 下载

下载最新的可安装版本：

[PaperMarginNote-v0.1.0.zip](https://github.com/hxhxz/PaperMarginNote/raw/main/PaperMarginNote-v0.1.0.zip)

下载后解压，在 Chrome 扩展管理页面中加载解压后的目录即可，也可以按照下方步骤从源码构建。

## 安装扩展

1. 下载并解压上面的安装包。
2. 在 Chrome 地址栏打开 `chrome://extensions`。
3. 开启页面右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择刚刚解压得到的 `dist` 目录。
6. 如需阅读本地 PDF，在扩展详情页开启“允许访问文件网址”。

安装完成后，点击浏览器工具栏中的 PaperMarginNote 图标即可打开 Side Panel。

## 使用方法

### 阅读与提问

1. 使用 Chrome 打开网络 PDF 或本地 PDF。
2. 点击扩展图标打开侧边栏。
3. 首次使用时打开设置，填写 API Base URL、API Key 和模型名称，并测试连接。
4. 在输入框中直接询问论文内容；需要网络背景资料时，可为当前问题启用“外部知识”。

### 对选中内容操作

在 PDF 中选中文字，然后打开右键菜单，可以：

- 翻译选中内容；
- 解释选中内容；
- 将原文作为引用附件加入输入框并继续提问；
- 尝试定位原文所属章节。

如果扩展无法可靠识别页码或章节，会保留原始引用，但不会生成虚假的定位信息。

### 生成知识文档

阅读结束后，点击侧边栏右上角的结束按钮。扩展会整理本次学习产生的理解、结论、问题和引用，并合并到当前论文的 Markdown 知识文档中，同时创建一个可恢复的历史版本。

## 从源码构建

环境要求：Node.js 18 或更高版本、npm 和 Chrome 浏览器。

```bash
git clone https://github.com/hxhxz/PaperMarginNote.git
cd PaperMarginNote
npm install
npm run build
```

构建结果位于 `dist/`。按照“安装扩展”中的步骤加载该目录。

开发和类型检查命令：

```bash
npm run dev
npm run typecheck
```

## 数据与权限

- `chrome.storage.local` 用于保存 API 配置和轻量偏好。
- IndexedDB 用于保存论文解析结果、对话、引用和知识文档版本。
- 网络 PDF 的访问权限按站点申请。
- 本地 PDF 需要用户手动允许扩展访问 `file://` 地址。
- API Key 不会写入对话导出、Markdown 文档或 Git 仓库。

## 当前限制

- 暂不支持扫描版 PDF 的 OCR。
- 不提供账号、云同步和团队协作能力。
- 不替换或修改 Chrome 原生 PDF 阅读器界面。
- 受 Chrome PDF 阅读器限制，扩展无法无条件获知当前滚动到的页码。

## 技术栈

- Chrome Extension Manifest V3
- React 18、TypeScript、Vite
- PDF.js、React Markdown

## License

项目暂未声明开源许可证。若计划接受外部贡献或允许他人复用代码，建议补充合适的 `LICENSE` 文件。
