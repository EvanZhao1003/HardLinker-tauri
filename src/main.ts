import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./style.css";

type Settings = {
  fileTargets: string[]; folderNames: string[]; language: string;
  lastFileTarget: string; lastFileSourceFolder: string; lastSourceFolder: string;
  lastFolderTarget: string; lastFolderName: string; defaultSourceFolder: string; defaultTargetFolder: string;
};
type LinkResult = { created: number; createdNames: string[]; failures: string[]; destinationFolder: string | null };
const defaults = (): Settings => ({ fileTargets: [], folderNames: [], language: "en", lastFileTarget: "", lastFileSourceFolder: "", lastSourceFolder: "", lastFolderTarget: "", lastFolderName: "", defaultSourceFolder: "", defaultTargetFolder: "" });
let settings = defaults();
let files: string[] = [];
let language: "en" | "zh" = "en";
let activeTab = "files";
type LogLevel = "info" | "success" | "error" | "warn";
type LogScope = "files" | "folders";
type LogEntry = { time: string; level: LogLevel; message: string };
const logs: Record<LogScope, LogEntry[]> = { files: [], folders: [] };
let running = false;
const words = {
  en: { subtitle: "Create Windows file hard links", files: "Files", folders: "Folders", settings: "Settings", sourceFiles: "Source files (multiple selection allowed)", addFiles: "Add files…", destination: "Destination folder", choose: "Choose…", remember: "Remember folder", createFiles: "Create file hard links", sourceFolder: "Source folder (top-level files only; no recursion)", parent: "Destination parent folder", folderName: "New folder name (defaults to source folder name)", rememberName: "Remember name", hint: "Existing files with the same name are skipped; cross-volume files are reported as failures. Subfolders are ignored.", createFolder: "Create folder hard links", language: "Language", defaultSource: "Default source folder", defaultTarget: "Default destination parent folder", saveDefaults: "Save default folders", warning: "Hard links share the same file data; changes through any link affect all links.", selected: (n: number) => `Selected ${n} file(s).`, missingTarget: "Choose an existing destination folder first.", missingFiles: "Add at least one source file first.", missingSource: "Choose an existing source folder first.", missingParent: "Choose an existing destination parent folder first.", invalidName: "Enter a valid single folder name.", defaultsSaved: "Default folders saved.", remembered: "Frequent destination folder saved.", rememberedName: "Frequent folder name saved.", summary: (n: number, f: number) => `Complete: ${n} hard link(s) created; ${f} failed.`, allSuccess: "All links were created successfully.", destinationLabel: "Destination folder", error: "Unable to continue", results: "Creation results", more: (n: number) => `${n} more failure(s).`, enterPath: "Enter or choose a folder path", logTitle: "Operation log", clearLog: "Clear", logEmpty: "No operations yet.", clearSelection: "Clear selection", startFiles: (n: number, target: string) => `Creating ${n} hard link(s): ${target}`, startFolders: (source: string, parent: string) => `Creating folder hard links from ${source} into ${parent}`, createdItem: (name: string) => `Created ${name}`, picked: (label: string, path: string) => `${label}: ${path}`, addedFile: (path: string) => `Added ${path}`, selectionTotal: (n: number) => `Selected ${n} source file(s).`, duplicateFiles: "Those files are already selected.", clearedSelection: "Selection cleared.", rememberedNameLog: (name: string) => `Saved folder name: ${name}`, rememberedTargetLog: (path: string) => `Saved destination folder: ${path}`, usedSavedName: (name: string) => `Used saved folder name: ${name}`, usedSavedTarget: (path: string) => `Used saved destination folder: ${path}`, deleteName: "Delete", pickNameFirst: "Select a saved name from the list first.", deletedName: (name: string) => `Deleted saved name: ${name}`, noSaved: "No saved items yet.", selectSavedName: "Saved folder names", selectSavedTarget: "Saved destination folders", deletedTarget: (path: string) => `Deleted saved destination: ${path}` },
  zh: { subtitle: "快速创建 Windows 文件硬链接", files: "文件", folders: "文件夹", settings: "设置", sourceFiles: "源文件（可多选）", addFiles: "添加文件…", destination: "目标目录", choose: "选择…", remember: "记住此目录", createFiles: "创建文件硬链接", sourceFolder: "源文件夹（只处理第一层普通文件，不递归）", parent: "目标父目录", folderName: "新建目录名称（默认使用源文件夹名称）", rememberName: "记住名称", hint: "已存在的同名文件会跳过；跨卷文件会报告失败。子目录不会处理。", createFolder: "创建文件夹硬链接", language: "界面语言", defaultSource: "默认源文件夹", defaultTarget: "默认目标父目录", saveDefaults: "保存默认目录", warning: "硬链接共享同一份文件数据；修改任一链接会影响其他链接。", selected: (n: number) => `已选择 ${n} 个文件。`, missingTarget: "请先选择一个存在的目标目录。", missingFiles: "请先添加至少一个源文件。", missingSource: "请先选择一个存在的源文件夹。", missingParent: "请先选择一个存在的目标父目录。", invalidName: "请输入有效的单层文件夹名称。", defaultsSaved: "默认目录已保存。", remembered: "常用目标目录已保存。", rememberedName: "常用文件夹名称已保存。", summary: (n: number, f: number) => `完成：成功创建 ${n} 个硬链接，失败 ${f} 个。`, allSuccess: "全部成功。", destinationLabel: "目标文件夹", error: "无法继续", results: "创建结果", more: (n: number) => `另有 ${n} 项失败。`, enterPath: "输入或选择目录路径", logTitle: "操作日志", clearLog: "清空", logEmpty: "暂无操作记录。", clearSelection: "清空选择", startFiles: (n: number, target: string) => `正在创建 ${n} 个硬链接：${target}`, startFolders: (source: string, parent: string) => `正在从 ${source} 创建文件夹硬链接到 ${parent}`, createdItem: (name: string) => `已创建 ${name}`, picked: (label: string, path: string) => `${label}：${path}`, addedFile: (path: string) => `已添加 ${path}`, selectionTotal: (n: number) => `当前共 ${n} 个源文件。`, duplicateFiles: "这些文件已在列表中。", clearedSelection: "已清空选择。", rememberedNameLog: (name: string) => `已记住文件夹名称：${name}`, rememberedTargetLog: (path: string) => `已记住目标目录：${path}`, usedSavedName: (name: string) => `使用已记住的文件夹名称：${name}`, usedSavedTarget: (path: string) => `使用已记住的目标目录：${path}`, deleteName: "删除", pickNameFirst: "请先在下拉列表中选择要删除的名称。", deletedName: (name: string) => `已删除记住的名称：${name}`, noSaved: "暂无记录。", selectSavedName: "已记住的名称", selectSavedTarget: "已记住的目标目录", deletedTarget: (path: string) => `已删除记住的目标目录：${path}` }
};
const t = () => words[language];
const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const pathName = (path: string) => path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
const restore = (recent: string, fallback: string) => recent || fallback;
const logMarks: Record<LogLevel, string> = { info: "•", success: "✓", error: "✕", warn: "!" };
function addLog(scope: LogScope, level: LogLevel, message: string) {
  const list = logs[scope];
  list.push({ time: new Date().toLocaleTimeString(language === "zh" ? "zh-CN" : "en-GB", { hour12: false }), level, message });
  if (list.length > 300) list.splice(0, list.length - 300);
  renderLog(scope);
}
function renderLog(scope: LogScope) {
  const el = document.querySelector<HTMLDivElement>(`#${scope}-log`);
  if (!el) return;
  const list = logs[scope];
  el.innerHTML = list.length
    ? list.map(e => `<div class="log-line ${e.level}"><span class="log-time">${e.time}</span><span class="log-mark">${logMarks[e.level]}</span><span class="log-msg">${esc(e.message)}</span></div>`).join("")
    : `<div class="log-empty">${t().logEmpty}</div>`;
  el.scrollTop = el.scrollHeight;
}
function logBlock(scope: LogScope) {
  return `<div class="log-wrap"><div class="log-head"><label>${t().logTitle}</label><button class="link-btn" id="clear-${scope}-log">${t().clearLog}</button></div><div class="log" id="${scope}-log"></div></div>`;
}
function savedPicker(id: string, values: string[], placeholder: string) {
  const items = values.length
    ? values.map(v => `<div class="picker-item"><button type="button" class="picker-label" data-pick="${esc(v)}" title="${esc(v)}">${esc(v)}</button><button type="button" class="picker-remove" data-drop="${esc(v)}" aria-label="${esc(t().deleteName)}">×</button></div>`).join("")
    : `<div class="picker-empty">${esc(t().noSaved)}</div>`;
  return `<div class="picker" id="${id}-picker"><button type="button" class="picker-toggle"><span>${esc(placeholder)}</span><span class="picker-caret">▾</span></button><div class="picker-menu">${items}</div></div>`;
}
function render() {
  const tr = t();
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `<main class="shell">
    <header><div class="brand-icon">H</div><div><h1>HardLinker</h1><p>${tr.subtitle}</p></div><span class="header-note">NTFS · HARD LINKS</span></header>
    <nav class="tabs"><button data-tab="files" class="tab ${activeTab === "files" ? "active" : ""}">${tr.files}</button><button data-tab="folders" class="tab ${activeTab === "folders" ? "active" : ""}">${tr.folders}</button><button data-tab="settings" class="tab ${activeTab === "settings" ? "active" : ""}">${tr.settings}</button></nav>
    <section class="panel ${activeTab === "files" ? "shown" : ""}" id="files-panel">
      <div class="row-label"><label>${tr.sourceFiles}</label><button class="secondary" id="add-files">＋ ${tr.addFiles}</button></div>
      ${files.length ? `<div class="file-meta"><span>${tr.selected(files.length)}</span><button class="link-btn" id="clear-files">${tr.clearSelection}</button></div>` : ""}
      <label class="field-label spaced">${tr.destination}</label><div class="path-row"><input id="file-target" value="${esc(restore(settings.lastFileTarget, settings.defaultTargetFolder))}" placeholder="${tr.enterPath}"/><button class="secondary" id="choose-file-target">${tr.choose}</button></div>
      <div class="row-label compact">${savedPicker("file-targets", settings.fileTargets, tr.selectSavedTarget)}<button class="secondary" id="remember-target">☆ ${tr.remember}</button></div>
      ${logBlock("files")}
      <div class="actions"><span id="selection-status">${files.length ? tr.selected(files.length) : ""}</span><button class="primary" id="create-files">${tr.createFiles}<span>→</span></button></div>
    </section>
    <section class="panel ${activeTab === "folders" ? "shown" : ""}" id="folders-panel">
      <label class="field-label">${tr.sourceFolder}</label><div class="path-row"><input id="source-folder" value="${esc(restore(settings.lastSourceFolder, settings.defaultSourceFolder))}" placeholder="${tr.enterPath}"/><button class="secondary" id="choose-source">${tr.choose}</button></div>
      <label class="field-label spaced">${tr.parent}</label><div class="path-row"><input id="folder-target" value="${esc(restore(settings.lastFolderTarget, settings.defaultTargetFolder))}" placeholder="${tr.enterPath}"/><button class="secondary" id="choose-folder-target">${tr.choose}</button></div>
      <label class="field-label spaced">${tr.folderName}</label><div class="path-row"><input id="folder-name" value="${esc(settings.lastFolderName)}"/><button class="secondary" id="remember-name">☆ ${tr.rememberName}</button></div>
      <div class="row-label compact">${savedPicker("folder-names", settings.folderNames, tr.selectSavedName)}</div>
      <div class="hint">ⓘ ${tr.hint}</div>
      ${logBlock("folders")}
      <div class="actions"><span></span><button class="primary" id="create-folder">${tr.createFolder}<span>→</span></button></div>
    </section>
    <section class="panel ${activeTab === "settings" ? "shown" : ""}" id="settings-panel">
      <label class="field-label">${tr.language}</label><select id="language" class="language"><option value="en" ${language === "en" ? "selected" : ""}>English</option><option value="zh" ${language === "zh" ? "selected" : ""}>中文</option></select>
      <label class="field-label spaced">${tr.defaultSource}</label><div class="path-row"><input id="default-source" value="${esc(settings.defaultSourceFolder)}" placeholder="${tr.enterPath}"/><button class="secondary" id="choose-default-source">${tr.choose}</button></div>
      <label class="field-label spaced">${tr.defaultTarget}</label><div class="path-row"><input id="default-target" value="${esc(settings.defaultTargetFolder)}" placeholder="${tr.enterPath}"/><button class="secondary" id="choose-default-target">${tr.choose}</button></div>
      <div class="actions"><span></span><button class="primary" id="save-defaults">${tr.saveDefaults}<span>✓</span></button></div>
    </section>
    <footer><span class="status-dot"></span>${tr.warning}<span class="version">v1.0</span></footer><div id="toast" class="toast"></div>
  </main>`;
  bind();
  renderLog("files");
  renderLog("folders");
}
function toast(message: string, error = false) { const el = document.querySelector<HTMLDivElement>("#toast")!; el.textContent = message; el.className = `toast visible${error ? " error" : ""}`; setTimeout(() => el.className = "toast", 3600); }
function val(id: string) { return document.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? ""; }
function bind() {
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(b => b.onclick = () => { activeTab = b.dataset.tab!; render(); });
  document.querySelector<HTMLButtonElement>("#clear-files")?.addEventListener("click", () => { files = []; addLog("files", "info", t().clearedSelection); render(); });
  (["files", "folders"] as LogScope[]).forEach(scope => {
    document.querySelector<HTMLButtonElement>(`#clear-${scope}-log`)?.addEventListener("click", () => { logs[scope] = []; renderLog(scope); });
  });
  type TextKey = "lastFileTarget" | "lastSourceFolder" | "lastFolderTarget" | "lastFolderName" | "defaultSourceFolder" | "defaultTargetFolder";
  const track = (id: string, key: TextKey) => {
    const input = document.querySelector<HTMLInputElement>(`#${id}`);
    if (input) input.addEventListener("input", () => { settings[key] = input.value; });
  };
  track("file-target", "lastFileTarget");
  track("source-folder", "lastSourceFolder");
  track("folder-target", "lastFolderTarget");
  track("folder-name", "lastFolderName");
  track("default-source", "defaultSourceFolder");
  track("default-target", "defaultTargetFolder");
  const choose = async (id: string, directory = true, multiple = false, initial?: string) => {
    const chosen = await open({ directory, multiple, defaultPath: initial || undefined, filters: directory ? undefined : [{ name: "All files", extensions: ["*"] }] });
    if (!chosen) return;
    if (multiple) {
      const selected = Array.isArray(chosen) ? chosen : [chosen];
      const known = new Set(files.map(f => f.toLowerCase()));
      const added = selected.filter(p => !known.has(p.toLowerCase()));
      files = [...files, ...added];
      settings.lastFileSourceFolder = selected[0].split(/[\\/]/).slice(0, -1).join("\\");
      added.forEach(p => addLog("files", "info", t().addedFile(p)));
      addLog("files", added.length ? "info" : "warn", added.length ? t().selectionTotal(files.length) : t().duplicateFiles);
      void persist(); render(); return;
    }
    const input = document.querySelector<HTMLInputElement>(`#${id}`);
    if (input) { input.value = chosen as string; input.dispatchEvent(new Event("input")); }
    const scope: Record<string, [LogScope, string]> = { "file-target": ["files", t().destination], "source-folder": ["folders", t().sourceFolder], "folder-target": ["folders", t().parent] };
    const entry = scope[id];
    if (entry) addLog(entry[0], "info", t().picked(entry[1], chosen as string));
  };
  document.querySelector<HTMLButtonElement>("#add-files")!.onclick = () => choose("", false, true, settings.lastFileSourceFolder || settings.defaultSourceFolder);
  document.querySelector<HTMLButtonElement>("#choose-file-target")!.onclick = () => choose("file-target", true, false, val("file-target"));
  document.querySelector<HTMLButtonElement>("#choose-source")!.onclick = async () => {
    await choose("source-folder", true, false, val("source-folder"));
    const inp = document.querySelector<HTMLInputElement>("#folder-name")!;
    const guessed = pathName(val("source-folder"));
    if (!settings.folderNames.includes(guessed)) { inp.value = guessed; inp.dispatchEvent(new Event("input")); }
  };
  document.querySelector<HTMLButtonElement>("#choose-folder-target")!.onclick = () => choose("folder-target", true, false, val("folder-target"));
  document.querySelector<HTMLButtonElement>("#choose-default-source")!.onclick = () => choose("default-source", true, false, val("default-source"));
  document.querySelector<HTMLButtonElement>("#choose-default-target")!.onclick = () => choose("default-target", true, false, val("default-target"));
  const remember = (list: string[], value: string) => [value, ...list.filter(i => i.toLowerCase() !== value.toLowerCase())].slice(0, 8);
  document.querySelector<HTMLButtonElement>("#remember-target")!.onclick = async () => {
    const target = val("file-target");
    if (!target) { addLog("files", "warn", t().missingTarget); return toast(t().missingTarget, true); }
    settings.lastFileTarget = target; settings.fileTargets = remember(settings.fileTargets, target);
    await persist(); addLog("files", "info", t().rememberedTargetLog(target)); toast(t().remembered); render();
  };
  const bindPicker = (id: string, onPick: (value: string) => void, onDrop: (value: string) => Promise<string>) => {
    const root = document.querySelector<HTMLDivElement>(`#${id}-picker`);
    if (!root) return;
    const menu = root.querySelector<HTMLDivElement>(".picker-menu")!;
    root.querySelector<HTMLButtonElement>(".picker-toggle")!.onclick = () => root.classList.toggle("open");
    root.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach(b => b.onclick = () => { onPick(b.dataset.pick!); root.classList.remove("open"); });
    root.querySelectorAll<HTMLButtonElement>("[data-drop]").forEach(b => b.onclick = async event => {
      event.stopPropagation();
      const message = await onDrop(b.dataset.drop!);
      b.closest(".picker-item")?.remove();
      if (!menu.querySelector(".picker-item")) menu.innerHTML = `<div class="picker-empty">${esc(t().noSaved)}</div>`;
      toast(message);
    });
  };
  bindPicker("file-targets", v => {
    const inp = document.querySelector<HTMLInputElement>("#file-target")!;
    inp.value = v; inp.dispatchEvent(new Event("input"));
    addLog("files", "info", t().usedSavedTarget(v));
  }, async v => {
    settings.fileTargets = settings.fileTargets.filter(p => p !== v);
    await persist(); addLog("files", "info", t().deletedTarget(v)); return t().deletedTarget(v);
  });
  bindPicker("folder-names", v => {
    const inp = document.querySelector<HTMLInputElement>("#folder-name")!;
    inp.value = v; inp.dispatchEvent(new Event("input"));
    addLog("folders", "info", t().usedSavedName(v));
  }, async v => {
    settings.folderNames = settings.folderNames.filter(n => n !== v);
    await persist(); addLog("folders", "info", t().deletedName(v)); return t().deletedName(v);
  });
  document.querySelector<HTMLButtonElement>("#remember-name")!.onclick = async () => {
    const name = val("folder-name");
    if (!name || /[\\/:*?"<>|]/.test(name) || name === "." || name === "..") { addLog("folders", "warn", t().invalidName); return toast(t().invalidName, true); }
    settings.lastFolderName = name; settings.folderNames = remember(settings.folderNames, name);
    await persist(); addLog("folders", "info", t().rememberedNameLog(name)); toast(t().rememberedName); render();
  };
  document.querySelector<HTMLSelectElement>("#language")!.onchange = async e => { language = (e.target as HTMLSelectElement).value as "en" | "zh"; settings.language = language; await persist(); render(); };
  document.querySelector<HTMLButtonElement>("#save-defaults")!.onclick = async () => { settings.defaultSourceFolder = val("default-source"); settings.defaultTargetFolder = val("default-target"); await persist(); toast(t().defaultsSaved); };
  document.querySelector<HTMLButtonElement>("#create-files")!.onclick = async () => {
    const target = val("file-target");
    if (!target) { addLog("files", "warn", t().missingTarget); return toast(t().missingTarget, true); }
    if (!files.length) { addLog("files", "warn", t().missingFiles); return toast(t().missingFiles, true); }
    settings.lastFileTarget = target; await persist();
    const sources = [...files];
    await perform("files", t().startFiles(sources.length, target), () => invoke<LinkResult>("create_file_links", { sources, target }));
  };
  document.querySelector<HTMLButtonElement>("#create-folder")!.onclick = async () => {
    const source = val("source-folder"), parent = val("folder-target"), name = val("folder-name");
    if (!source) { addLog("folders", "warn", t().missingSource); return toast(t().missingSource, true); }
    if (!parent) { addLog("folders", "warn", t().missingParent); return toast(t().missingParent, true); }
    settings.lastSourceFolder = source; settings.lastFolderTarget = parent; settings.lastFolderName = name; await persist();
    await perform("folders", t().startFolders(source, parent), () => invoke<LinkResult>("create_folder_links", { source, parent, name }));
  };
}
async function persist() { await invoke("save_settings", { settings }); }
async function perform(scope: LogScope, start: string, operation: () => Promise<LinkResult>) {
  if (running) return;
  running = true;
  const button = document.querySelector<HTMLButtonElement>(scope === "files" ? "#create-files" : "#create-folder");
  if (button) button.disabled = true;
  addLog(scope, "info", start);
  try {
    const result = await operation();
    const failed = result.failures.length;
    if (result.destinationFolder) addLog(scope, "info", `${t().destinationLabel}: ${result.destinationFolder}`);
    (result.createdNames ?? []).forEach(name => addLog(scope, "success", t().createdItem(name)));
    result.failures.forEach(failure => addLog(scope, "error", failure));
    addLog(scope, failed ? "warn" : "success", t().summary(result.created, failed));
    toast(t().summary(result.created, failed), failed > 0);
  } catch (error) {
    addLog(scope, "error", `${t().error}: ${String(error)}`);
    toast(String(error), true);
  } finally {
    running = false;
    if (button) button.disabled = false;
  }
}

async function start() {
  try { settings = { ...defaults(), ...await invoke<Settings>("load_settings") }; language = settings.language === "zh" ? "zh" : "en"; settings.language = language; }
  catch { settings = defaults(); }
  render();
}
const closePickers = () => document.querySelectorAll<HTMLDivElement>(".picker.open").forEach(p => p.classList.remove("open"));
document.addEventListener("pointerdown", event => {
  const target = event.target as Node;
  document.querySelectorAll<HTMLDivElement>(".picker.open").forEach(p => { if (!p.contains(target)) p.classList.remove("open"); });
});
document.addEventListener("keydown", event => { if (event.key === "Escape") closePickers(); });
void start();
