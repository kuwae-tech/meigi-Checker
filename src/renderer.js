const dropzone = document.getElementById("dropzone");
const pickBtn = document.getElementById("pickBtn");
const fileName = document.getElementById("fileName");
const msg = document.getElementById("msg");
const output = document.getElementById("output");
const copyBtn = document.getElementById("copyBtn");

function setMessage(text, isError = false) {
  msg.textContent = text || "";
  msg.style.color = isError ? "#ff7a7a" : "#ffd479";
}

function setFileName(path) {
  fileName.textContent = path ? path : "";
}

async function processPath(path) {
  if (!path) return;
  setMessage("処理中...");
  setFileName(path);
  output.value = "";
  copyBtn.disabled = true;

  const res = await window.api.processFile(path);
  if (!res || !res.ok) {
    setMessage(res?.error || "処理に失敗しました。", true);
    return;
  }

  output.value = res.text || "";
  copyBtn.disabled = !output.value.trim();
  setMessage("完了しました。");
}

pickBtn.addEventListener("click", async () => {
  const p = await window.api.selectFile();
  if (p) await processPath(p);
});

copyBtn.addEventListener("click", () => {
  window.api.copyText(output.value);
  setMessage("コピーしました。");
});

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});
dropzone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!f) return;
  await processPath(f.path);
});
