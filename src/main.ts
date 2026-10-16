import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./style.css";

type Settings = {
  fileTargets: string[]; folderNames: string[]; language: string;
  lastFileTarget: string; lastFileSourceFolder: string; lastSourceFolder: string;
  lastFolderTarget: string; lastFolderName: string; defaultSourceFolder: string; defaultTargetFolder: string;
};
type LinkResult = { created: number; failures: string[]; destinationFolder: string | null };
const defaults = (): Settings => ({ fileTargets: [], folderNames: [], language: "en", lastFileTarget: "", lastFileSourceFolder: "", lastSourceFolder: "", lastFolderTarget: "", lastFolderName: "", defaultSourceFolder: "", defaultTargetFolder: "" });
let settings = defaults();
let files: string[] = [];
let language: "en" | "zh" = "en";
let activeTab = "files";
const words = {
  en: { subtitle: "Create Windows file hard links", files: "Files", folders: "Folders", settings: "Settings", sourceFiles: "Source files (multiple selection allowed)", addFiles: "Add files…", destination: "Destination folder", choose: "Choose…", remember: "Remember folder", createFiles: "Create file hard links", sourceFolder: "Source folder (top-level files only; no recursion)", parent: "Destination parent folder", folderName: "New folder name (defaults to source folder name)", rememberName: "Remember name", hint: "Existing files with the same name are skipped; cross-volume files are reported as failures. Subfolders are ignored.", createFolder: "Create folder hard links", language: "Language", defaultSource: "Default source folder", defaultTarget: "Default destination parent folder", saveDefaults: "Save default folders", warning: "Hard links share the same file data; changes through any link affect all links.", selected: (n: number) => `Selected ${n} file(s).`, missingTarget: "Choose an existing destination folder first.", missingFiles: "Add at least one source file first.", missingSource: "Choose an existing source folder first.", missingParent: "Choose an existing destination parent folder first.", invalidName: "Enter a valid single folder name.", defaultsSaved: "Default folders saved.", remembered: "Frequent destination folder saved.", rememberedName: "Frequent folder name saved.", summary: (n: number, f: number) => `Complete: ${n} hard link(s) created; ${f} failed.`, allSuccess: "All links were created successfully.", destinationLabel: "Destination folder", error: "Unable to continue", results: "Creation results", more: (n: number) => `${n} more failure(s).`, enterPath: "Enter or choose a folder path", noFiles: "No files selected yet." },
  zh: { subtitle: "快速创建 Windows 文件硬链接", files: "文件", folders: "文件夹", settings: "设置", sourceFiles: "源文件（可多选）", addFiles: "添加文件…", destination: "目标目录", choose: "选择…", remember: "记住此目录", createFiles: "创建文件硬链接", sourceFolder: "源文件夹（只处理第一层普通文件，不递归）", parent: "目标父目录", folderName: "新建目录名称（默认使用源文件夹名称）", rememberName: "记住名称", hint: "已存在的同名文件会跳过；跨卷文件会报告失败。子目录不会处理。", createFolder: "创建文件夹硬链接", language: "界面语言", defaultSource: "默认源文件夹", defaultTarget: "默认目标父目录", saveDefaults: "保存默认目录", warning: "硬链接共享同一份文件数据；修改任一链接会影响其他链接。", selected: (n: number) => `已选择 ${n} 个文件。`, missingTarget: "请先选择一个存在的目标目录。", missingFiles: "请先添加至少一个源文件。", missingSource: "请先选择一个存在的源文件夹。", missingParent: "请先选择一个存在的目标父目录。", invalidName: "请输入有效的单层文件夹名称。", defaultsSaved: "默认目录已保存。", remembered: "常用目标目录已保存。", rememberedName: "常用文件夹名称已保存。", summary: (n: number, f: number) => `完成：成功创建 ${n} 个硬链接，失败 ${f} 个。`, allSuccess: "全部成功。", destinationLabel: "目标文件夹", error: "无法继续", results: "创建结果", more: (n: number) => `另有 ${n} 项失败。`, enterPath: "输入或选择目录路径", noFiles: "尚未选择文件。" }
};
const t = () => words[language];
const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const pathName = (path: string) => path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
const restore = (recent: string, fallback: string) => recent || fallback;
function render() {
  const tr = t();
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `<main class="shell">
    <header><div class="brand-icon">H</div><div><h1>HardLinker</h1><p>${tr.subtitle}</p></div><span class="header-note">NTFS · HARD LINKS</span></header>
    <nav class="tabs"><button data-tab="files" class="tab ${activeTab === "files" ? "active" : ""}">${tr.files}</button><button data-tab="folders" class="tab ${activeTab === "folders" ? "active" : ""}">${tr.folders}</button><button data-tab="settings" class="tab ${activeTab === "settings" ? "active" : ""}">${tr.settings}</button></nav>
    <section class="panel ${activeTab === "files" ? "shown" : ""}" id="files-panel">
      <div class="row-label"><label>${tr.sourceFiles}</label><button class="secondary" id="add-files">＋ ${tr.addFiles}</button></div>
      <div class="file-list">${files.length ? files.map((f, i) => `<div class="file-item"><span class="file-mark">▤</span><span class="file-path" title="${esc(f)}">${esc(f)}</span><button class="remove" data-remove="${i}" aria-label="Remove">×</button></div>`).join("") : `<div class="empty">${tr.noFiles}</div>`}</div>
      <label class="field-label">${tr.destination}</label><div class="path-row"><input id="file-target" value="${esc(restore(settings.lastFileTarget, settings.defaultTargetFolder))}" placeholder="${tr.enterPath}"/><button class="secondary" id="choose-file-target">${tr.choose}</button></div>
      <div class="row-label compact"><select id="file-targets"><option value=""></option>${settings.fileTargets.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}</select><button class="secondary" id="remember-target">☆ ${tr.remember}</button></div>
      <div class="actions"><span id="selection-status">${files.length ? tr.selected(files.length) : ""}</span><button class="primary" id="create-files">${tr.createFiles}<span>→</span></button></div>
    </section>
    <section class="panel ${activeTab === "folders" ? "shown" : ""}" id="folders-panel">
      <label class="field-label">${tr.sourceFolder}</label><div class="path-row"><input id="source-folder" value="${esc(restore(settings.lastSourceFolder, settings.defaultSourceFolder))}" placeholder="${tr.enterPath}"/><button class="secondary" id="choose-source">${tr.choose}</button></div>
      <label class="field-label spaced">${tr.parent}</label><div class="path-row"><input id="folder-target" value="${esc(restore(settings.lastFolderTarget, settings.defaultTargetFolder))}" placeholder="${tr.enterPath}"/><button class="secondary" id="choose-folder-target">${tr.choose}</button></div>
      <label class="field-label spaced">${tr.folderName}</label><div class="path-row"><input id="folder-name" value="${esc(settings.lastFolderName)}"/><button class="secondary" id="remember-name">☆ ${tr.rememberName}</button></div>
      <div class="row-label compact"><select id="folder-names"><option value=""></option>${settings.folderNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select></div>
      <div class="hint">ⓘ ${tr.hint}</div><div class="actions"><span></span><button class="primary" id="create-folder">${tr.createFolder}<span>→</span></button></div>
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
}
function toast(message: string, error = false) { const el = document.querySelector<HTMLDivElement>("#toast")!; el.textContent = message; el.className = `toast visible${error ? " error" : ""}`; setTimeout(() => el.className = "toast", 3600); }
function val(id: string) { return document.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? ""; }
function bind() {
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(b => b.onclick = () => { activeTab = b.dataset.tab!; render(); });
  document.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(b => b.onclick = () => { files.splice(Number(b.dataset.remove), 1); render(); });
  const choose = async (id: string, directory = true, multiple = false, initial?: string) => {
    const chosen = await open({ directory, multiple, defaultPath: initial || undefined, filters: directory ? undefined : [{ name: "All files", extensions: ["*"] }] });
    if (!chosen) return;
    if (multiple) { const selected = Array.isArray(chosen) ? chosen : [chosen]; files = [...new Set([...files, ...selected])]; settings.lastFileSourceFolder = selected[0].split(/[\\/]/).slice(0, -1).join("\\"); void persist(); render(); return; }
    const input = document.querySelector<HTMLInputElement>(`#${id}`); if (input) input.value = chosen as string;
  };
  document.querySelector<HTMLButtonElement>("#add-files")!.onclick = () => choose("", false, true, settings.lastFileSourceFolder || settings.defaultSourceFolder);
  document.querySelector<HTMLButtonElement>("#choose-file-target")!.onclick = () => choose("file-target", true, false, val("file-target"));
  document.querySelector<HTMLButtonElement>("#choose-source")!.onclick = async () => { await choose("source-folder", true, false, val("source-folder")); const inp = document.querySelector<HTMLInputElement>("#folder-name")!; if (!settings.folderNames.includes(pathName(val("source-folder")))) inp.value = pathName(val("source-folder")); };
  document.querySelector<HTMLButtonElement>("#choose-folder-target")!.onclick = () => choose("folder-target", true, false, val("folder-target"));
  document.querySelector<HTMLButtonElement>("#choose-default-source")!.onclick = () => choose("default-source", true, false, val("default-source"));
  document.querySelector<HTMLButtonElement>("#choose-default-target")!.onclick = () => choose("default-target", true, false, val("default-target"));
  const remember = (list: string[], value: string) => [value, ...list.filter(i => i.toLowerCase() !== value.toLowerCase())].slice(0, 8);
  document.querySelector<HTMLButtonElement>("#remember-target")!.onclick = async () => { const target = val("file-target"); if (!target) return toast(t().missingTarget, true); settings.lastFileTarget = target; settings.fileTargets = remember(settings.fileTargets, target); await persist(); toast(t().remembered); render(); };
  document.querySelector<HTMLSelectElement>("#file-targets")!.onchange = e => { const v = (e.target as HTMLSelectElement).value; if (v) document.querySelector<HTMLInputElement>("#file-target")!.value = v; };
  document.querySelector<HTMLButtonElement>("#remember-name")!.onclick = async () => { const name = val("folder-name"); if (!name || /[\\/:*?"<>|]/.test(name) || name === "." || name === "..") return toast(t().invalidName, true); settings.lastFolderName = name; settings.folderNames = remember(settings.folderNames, name); await persist(); toast(t().rememberedName); render(); };
  document.querySelector<HTMLSelectElement>("#folder-names")!.onchange = e => { const v = (e.target as HTMLSelectElement).value; if (v) document.querySelector<HTMLInputElement>("#folder-name")!.value = v; };
  document.querySelector<HTMLSelectElement>("#language")!.onchange = async e => { language = (e.target as HTMLSelectElement).value as "en" | "zh"; settings.language = language; await persist(); render(); };
  document.querySelector<HTMLButtonElement>("#save-defaults")!.onclick = async () => { settings.defaultSourceFolder = val("default-source"); settings.defaultTargetFolder = val("default-target"); await persist(); toast(t().defaultsSaved); };
  document.querySelector<HTMLButtonElement>("#create-files")!.onclick = async () => {
    const target = val("file-target"); if (!target) return toast(t().missingTarget, true); if (!files.length) return toast(t().missingFiles, true);
    settings.lastFileTarget = target; await persist(); await perform(() => invoke<LinkResult>("create_file_links", { sources: files, target }));
  };
  document.querySelector<HTMLButtonElement>("#create-folder")!.onclick = async () => {
    const source = val("source-folder"), parent = val("folder-target"), name = val("folder-name");
    if (!source) return toast(t().missingSource, true); if (!parent) return toast(t().missingParent, true);
    settings.lastSourceFolder = source; settings.lastFolderTarget = parent; settings.lastFolderName = name; await persist();
    await perform(() => invoke<LinkResult>("create_folder_links", { source, parent, name }));
  };
}
async function persist() { await invoke("save_settings", { settings }); }
async function perform(operation: () => Promise<LinkResult>) {
  try { const result = await operation(); const count = result.failures.length; const details = count ? result.failures.slice(0, 12).join("\n") + (count > 12 ? `\n${t().more(count - 12)}` : "") : t().allSuccess; const prefix = result.destinationFolder ? `${t().destinationLabel}: ${result.destinationFolder}\n\n` : ""; window.alert(`${t().summary(result.created, count)}\n\n${prefix}${details}`); }
  catch (error) { toast(String(error), true); }
}

async function start() {
  try { settings = { ...defaults(), ...await invoke<Settings>("load_settings") }; language = settings.language === "zh" ? "zh" : "en"; settings.language = language; }
  catch { settings = defaults(); }
  render();
}
void start();
