"use strict";

const DEBUG = true;

// 全局变量
let gLogoFolder = null;  // 用户选择的素材/规范汇总文件夹
let gIsReady = false;    // 是否已就绪

function log(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

// ==================== 放置图片 ====================
async function placeImageFromFolder(folderEntry) {
    const fs = require("uxp").storage.localFileSystem;
    const app = require("photoshop").app;
    const batchPlay = require("photoshop").action.batchPlay;
    const executeAsModal = require("photoshop").core.executeAsModal;

    // 检查是否已就绪
    if (!gIsReady) {
        updateStatus("请先点击「初始化」！");
        return;
    }

    log("选择文件夹:", folderEntry.name);

    // 检查是否有打开的文档
    if (app.documents.length === 0) {
        updateStatus("请先打开一个 Photoshop 文档！");
        return;
    }

    const originalDoc = app.activeDocument;
    log("原文档:", originalDoc.name);

    try {
        // 打开文件选择器
        let fileEntry;
        if (folderEntry && folderEntry.isFolder) {
            fileEntry = await fs.getFileForOpening({
                initialLocation: folderEntry,
                types: ["png", "jpg", "jpeg", "gif", "bmp", "tiff", "psd"]
            });
        } else {
            fileEntry = await fs.getFileForOpening({
                types: ["png", "jpg", "jpeg", "gif", "bmp", "tiff", "psd"]
            });
        }

        if (!fileEntry) {
            updateStatus("已取消");
            return;
        }

        log("选择文件:", fileEntry.name);
        updateStatus("正在放置: " + fileEntry.name);

        // 在 executeAsModal 内执行
        await executeAsModal(async (modalContext) => {
            // 打开图片
            const imageDoc = await app.open(fileEntry);
            const imageDocId = imageDoc._id;
            log("图片文档:", imageDoc.name);

            // 获取图层并复制
            const layers = imageDoc.layers;
            if (layers && layers.length > 0) {
                const sourceLayer = layers[0];
                log("源图层:", sourceLayer.name);

                // 使用 layer.duplicate() 复制到目标文档
                sourceLayer.duplicate(originalDoc);
                log("已复制到:", originalDoc.name);
            }

            // 关闭图片文档（不保存）
            await batchPlay([{
                _obj: "close",
                _target: { _ref: "document", _id: imageDocId },
                _options: { _decision: "dontSaveChanges" }
            }], { modalBehavior: "execute" });

        }, { "commandName": "Place Image" });

        updateStatus("放置完成！");

    } catch (e) {
        log("错误:", e.message);
        updateStatus("错误: " + e.message);
    }
}

// ==================== 更新状态显示 ====================
function updateStatus(text) {
    const statusEl = document.getElementById("status");
    if (statusEl) {
        statusEl.textContent = text;
    }
}

// ==================== 读取子文件夹 ====================
async function getSubfolders(folderEntry) {
    const subfolders = [];

    try {
        const entries = await folderEntry.getEntries();

        for (const entry of entries) {
            if (entry.isFolder) {
                subfolders.push({
                    name: entry.name,
                    entry: entry
                });
            }
        }
    } catch (e) {
        log("读取子文件夹失败:", e.message);
    }

    return subfolders;
}

// ==================== 创建按钮 ====================
function createButtons(subfolders) {
    const btnGroup = document.querySelector(".button-group");
    if (!btnGroup) return;

    // 清空按钮组
    btnGroup.innerHTML = "";

    // 添加固定按钮（初始化、刷新）
    const initBtn = document.createElement("button");
    initBtn.textContent = "初始化";
    initBtn.addEventListener("click", startup);
    btnGroup.appendChild(initBtn);

    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "刷新";
    refreshBtn.addEventListener("click", async () => {
        updateStatus("正在刷新...");
        const subfolders = await getSubfolders(gLogoFolder);
        createButtons(subfolders);
        updateStatus("就绪！共 " + (subfolders.length || 1) + " 个分组");
    });
    btnGroup.appendChild(refreshBtn);

    // 添加分隔提示
    const divider = document.createElement("div");
    divider.className = "divider";
    divider.textContent = "--- 点击初始化开始使用 ---";
    btnGroup.appendChild(divider);

    // 添加动态按钮（子文件夹按钮）
    if (subfolders.length === 0) {
        // 没有子文件夹，创建按钮名称为文件夹名
        const btn = document.createElement("button");
        btn.textContent = gLogoFolder ? gLogoFolder.name : "素材";
        btn.addEventListener("click", () => placeImageFromFolder(gLogoFolder));
        btnGroup.appendChild(btn);
    } else {
        // 为每个子文件夹创建按钮
        subfolders.forEach((folder) => {
            const btn = document.createElement("button");
            btn.textContent = folder.name;
            btn.addEventListener("click", () => placeImageFromFolder(folder.entry));
            btnGroup.appendChild(btn);
        });
    }

    log("创建了", subfolders.length || 1, "个按钮");
}

// ==================== 启动函数 ====================
async function startup() {
    log("初始化...");
    updateStatus("正在初始化...");

    try {
        const fs = require("uxp").storage.localFileSystem;

        // 让用户选择素材/规范汇总文件夹
        updateStatus("请选择素材/规范汇总文件夹...");

        // 使用 getFolder 打开文件夹选择器
        let folderEntry = await fs.getFolder();

        if (!folderEntry) {
            updateStatus("已取消初始化");
            gIsReady = false;
            return;
        }

        log("用户选择了:", folderEntry.name);

        // 保存选择到 localStorage
        localStorage.setItem("logoFolderPath", folderEntry.nativePath);

        // 保存到全局变量
        gLogoFolder = folderEntry;

        // 读取子文件夹
        let subfolders = [];
        if (folderEntry && folderEntry.isFolder) {
            subfolders = await getSubfolders(folderEntry);
            log("找到子文件夹:", subfolders.map(f => f.name).join(", "));
        }

        gIsReady = true;
        createButtons(subfolders);
        updateStatus("就绪！共 " + (subfolders.length || 1) + " 个分组");

    } catch (e) {
        log("初始化失败:", e.message);
        updateStatus("初始化失败: " + e.message);
        gIsReady = false;
        createButtons([]);
    }
}

// ==================== 初始化 ====================
function init() {
    log("初始化...");
    updateStatus("点击「初始化」开始使用");

    // 创建初始按钮界面（只有固定按钮）
    const btnGroup = document.querySelector(".button-group");
    if (!btnGroup) return;

    btnGroup.innerHTML = "";

    // 创建初始化按钮
    const initBtn = document.createElement("button");
    initBtn.textContent = "初始化";
    initBtn.id = "btnInit";
    initBtn.addEventListener("click", startup);
    btnGroup.appendChild(initBtn);

    // 创建刷新按钮
    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "刷新";
    refreshBtn.id = "btnRefresh";
    btnGroup.appendChild(refreshBtn);

    // 添加分隔提示
    const divider = document.createElement("div");
    divider.className = "divider";
    divider.textContent = "--- 点击初始化开始使用 ---";
    btnGroup.appendChild(divider);
}

// ==================== UI 事件绑定 ====================
document.addEventListener("DOMContentLoaded", () => {
    log("DOM 加载完成");
    init();
});

// ==================== 外部链接：用 UXP shell 打开 ====================
(function () {
    let openFn = null;
    try {
        const s = require("uxp").shell;
        if (s && typeof s.openExternal === "function") openFn = (u) => s.openExternal(u);
    } catch (e) {}

    document.body.addEventListener("click", (e) => {
        const el = e.target.closest ? e.target.closest(".ext-link") : null;
        if (!el) return;
        const url = el.getAttribute("data-url");
        if (!url || !openFn) return;
        openFn(url).catch((err) => {
            console.error("[导入器] openExternal 失败:", err && err.message);
        });
    });

    document.querySelectorAll(".ext-link").forEach((el) => {
        el.style.cursor = "pointer";
    });
})();
