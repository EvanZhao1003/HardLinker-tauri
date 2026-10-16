# HardLinker

[English](README.md) | [简体中文](README.zh-CN.md)

A lightweight Windows desktop utility built with Tauri 2 for creating file hard links.

## Features

- **File mode:** Select multiple source files and link them into an existing destination folder.
- **Folder mode:** Link regular files from the top level of a source folder into a newly created destination folder. Subfolders are not processed recursively.
- Configure default source and destination folders. Recent paths, frequent destinations, and folder names are saved between runs.
- Switch the interface between English and Chinese. English is the default language.
- Existing destination names are never overwritten. The app reports successes and failures for each item.

Settings remain at `%AppData%\HardLinker\settings.json` on Windows.

Hard links can only be created on the same volume. They share the same file data, so changes made through one link are visible through the others.

## Build and run

Install Node.js, Rust, and the [Tauri prerequisites for Windows](https://tauri.app/start/prerequisites/), then run:

```powershell
npm install
npm run tauri dev
```

Create a production bundle with:

```powershell
npm run tauri build
```

Build the executable without creating an installer:

```powershell
npm run tauri -- build --no-bundle
```

The executable is written to `src-tauri\target\release\hardlinker.exe`.
