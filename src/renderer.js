const dropZone = document.getElementById('drop-zone');
const selectButton = document.getElementById('select-file');
const fileName = document.getElementById('file-name');
const output = document.getElementById('output');
const copyButton = document.getElementById('copy-button');
const resetButton = document.getElementById('resetBtn');
const statusMessage = document.getElementById('status-message');
const statusText = statusMessage.querySelector('.status-text');
const noticesBox = document.getElementById('notices');

const initialStatusMessage = 'ファイルを読み込むと結果が表示されます。';
let lastResult = null;

const setStatus = (message, type = 'info', isLoading = false) => {
  statusText.textContent = message;
  statusMessage.dataset.type = type;
  statusMessage.classList.toggle('is-loading', isLoading);
};

const renderOutput = (text) => {
  output.value = text;
  copyButton.disabled = !text;
  lastResult = text || null;
};

const renderNotices = (notices = []) => {
  const list = Array.isArray(notices) ? notices.filter(Boolean) : [];
  if (list.length === 0) {
    noticesBox.textContent = '';
    noticesBox.classList.remove('is-visible');
    return;
  }
  noticesBox.textContent = list.join('\n');
  noticesBox.classList.add('is-visible');
};

const handleFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  fileName.textContent = filePath;
  setStatus('読み込み中...', 'info', true);

  try {
    const res = await window.api.parseExcel(filePath);
    if (res && typeof res === 'object') {
      if (!res.ok) {
        throw new Error(res.error || '処理に失敗しました');
      }
      renderOutput(String(res.text ?? ''));
      renderNotices(res.notices);
    } else if (typeof res === 'string') {
      renderOutput(res);
      renderNotices([]);
    } else {
      renderOutput(JSON.stringify(res, null, 2));
      renderNotices([]);
    }
    setStatus('抽出しました。コピーできます。', 'success');
  } catch (error) {
    renderOutput('');
    renderNotices([]);
    setStatus('読み取れませんでした。ファイルをご確認ください。', 'error');
  }
};

const resetUI = () => {
  fileName.textContent = '未選択';
  renderOutput('');
  renderNotices([]);
  setStatus(initialStatusMessage, 'info');
  copyButton.disabled = true;
  dropZone.classList.remove('is-dragging');
  lastResult = null;
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

resetButton.addEventListener('click', () => {
  const ok = window.confirm('読み込み内容と結果をリセットします。よろしいですか？');
  if (!ok) {
    return;
  }
  resetUI();
});
