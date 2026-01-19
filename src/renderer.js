const dropZone = document.getElementById('drop-zone');
const selectButton = document.getElementById('select-file');
const fileName = document.getElementById('file-name');
const output = document.getElementById('output');
const copyButton = document.getElementById('copy-button');
const statusMessage = document.getElementById('status-message');

const setStatus = (message, type = 'info') => {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
};

const renderOutput = (text) => {
  output.value = text;
  copyButton.disabled = !text;
};

const handleFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  fileName.textContent = filePath;
  setStatus('読み込み中...', 'info');

  try {
    const text = await window.api.parseExcel(filePath);
    renderOutput(text);
    setStatus('抽出完了。コピーできます。', 'success');
  } catch (error) {
    renderOutput('');
    setStatus(error.message || '読み込みに失敗しました。', 'error');
  }
};

const handleDrop = (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragging');

  if (!event.dataTransfer?.files?.length) {
    return;
  }

  const filePath = event.dataTransfer.files[0].path;
  handleFile(filePath);
};

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
  });
});

dropZone.addEventListener('drop', handleDrop);

selectButton.addEventListener('click', async () => {
  const filePath = await window.api.openFile();
  handleFile(filePath);
});

copyButton.addEventListener('click', async () => {
  try {
    await window.api.copyText(output.value);
    setStatus('コピーしました。', 'success');
  } catch (error) {
    setStatus('コピーに失敗しました。', 'error');
  }
});
