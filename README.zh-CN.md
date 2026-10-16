# HardLinker

[English](README.md) | [简体中文](README.zh-CN.md)

一个使用 Tauri 2 构建的轻量 Windows 桌面文件硬链接工具。

## 功能

- **文件模式：** 选择多个源文件，将它们硬链接到已存在的目标目录。
- **文件夹模式：** 将源文件夹第一层的普通文件硬链接到新建的目标文件夹中，不递归处理子文件夹。
- 可配置默认源目录和目标目录，并记住最近使用的路径、常用目标目录和文件夹名称。
- 界面支持英语和中文，默认使用英语。
- 不会覆盖已存在的目标名称，并逐项报告成功和失败结果。

Windows 设置仍保存在 `%AppData%\HardLinker\settings.json`。

硬链接只能在同一卷内创建。硬链接共享同一份文件数据，因此通过任一链接修改内容，其他链接也会看到修改。

## 构建和运行

安装 Node.js、Rust 和 [Windows Tauri 构建依赖](https://tauri.app/start/prerequisites/)，然后运行：

```powershell
npm install
npm run tauri dev
```

创建生产安装包：

```powershell
npm run tauri build
```
