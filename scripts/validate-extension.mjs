#!/usr/bin/env node
// 校验 Chrome 扩展的完整性。
//
// 检查什么、为什么：
//   1. manifest.json 是合法 JSON —— 手改时漏个逗号，扩展直接加载不了
//   2. manifest 引用的每个文件都存在 —— 重命名/移动文件后忘了改 manifest 是
//      扩展加载失败最常见的原因，而且 Chrome 的报错信息很不直观
//   3. popup.html 引用的本地资源存在 —— 同上，但 manifest 检查覆盖不到
//   4. 所有 .js 语法正确 —— 由 node --check 做，见 workflow
//
// 退出码非 0 表示校验失败。

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "netease-intro-extension";
const errors = [];
const checked = new Set();

function mustExist(relPath, why) {
  const full = join(ROOT, relPath);
  checked.add(relPath);
  if (!existsSync(full)) {
    errors.push(`${why} 引用了不存在的文件: ${relPath}`);
  }
}

// ---- 1. manifest 合法性 ----
const manifestPath = join(ROOT, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`找不到 ${manifestPath}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error(`manifest.json 不是合法 JSON: ${e.message}`);
  process.exit(1);
}

if (manifest.manifest_version !== 3) {
  errors.push(`manifest_version 应为 3，实际是 ${manifest.manifest_version}`);
}
for (const field of ["name", "version", "description"]) {
  if (!manifest[field]) errors.push(`manifest 缺少必填字段: ${field}`);
}
// Chrome 要求版本号是 1~4 段数字
if (manifest.version && !/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
  errors.push(`version 格式不合法（需为 1~4 段数字）: ${manifest.version}`);
}

// ---- 2. manifest 引用的文件 ----
for (const [size, p] of Object.entries(manifest.icons ?? {})) {
  mustExist(p, `icons["${size}"]`);
}
for (const [size, p] of Object.entries(manifest.action?.default_icon ?? {})) {
  mustExist(p, `action.default_icon["${size}"]`);
}
if (manifest.action?.default_popup) {
  mustExist(manifest.action.default_popup, "action.default_popup");
}
if (manifest.background?.service_worker) {
  mustExist(manifest.background.service_worker, "background.service_worker");
}
(manifest.content_scripts ?? []).forEach((cs, i) => {
  if (!cs.matches?.length) errors.push(`content_scripts[${i}] 没有 matches`);
  for (const p of cs.js ?? []) mustExist(p, `content_scripts[${i}].js`);
  for (const p of cs.css ?? []) mustExist(p, `content_scripts[${i}].css`);
});
for (const res of manifest.web_accessible_resources ?? []) {
  for (const p of res.resources ?? []) {
    // 这里可能是 glob，只检查不含通配符的
    if (!p.includes("*")) mustExist(p, "web_accessible_resources");
  }
}

// ---- 3. HTML 里引用的本地资源 ----
const htmlFiles = [manifest.action?.default_popup, manifest.options_page].filter(Boolean);
for (const html of htmlFiles) {
  const full = join(ROOT, html);
  if (!existsSync(full)) continue; // 上面已报过
  const src = readFileSync(full, "utf8");
  for (const m of src.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = m[1];
    // 跳过外链、data URI、锚点
    if (/^(https?:|data:|#|\/\/)/.test(ref)) continue;
    // HTML 里的相对路径是相对于该 HTML 所在目录，不是扩展根目录
    mustExist(join(dirname(html), ref), `${html}`);
  }
}

// ---- 结果 ----
if (errors.length) {
  console.error("扩展校验失败：");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`扩展校验通过（${manifest.name} v${manifest.version}，检查了 ${checked.size} 个引用）`);
