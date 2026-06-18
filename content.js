(function() {
  // Prevent duplicate execution
  if (document.getElementById('coconala-talkroom-saver-root')) return;

  // Create UI Container
  const root = document.createElement('div');
  root.id = 'coconala-talkroom-saver-root';
  root.innerHTML = `
    <div class="csaver-footer">
      <div class="csaver-container">
        <div class="csaver-title-wrapper">
          <span class="csaver-title">Coconala Talkroom Saver</span>
          <span class="csaver-subtitle">ココナラ トーク履歴保存</span>
        </div>
        <button id="csaver-download-btn" class="csaver-btn">
          <svg class="csaver-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
          </svg>
          <span class="csaver-btn-text">JSON保存</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const btn = document.getElementById('csaver-download-btn');
  const btnText = btn.querySelector('.csaver-btn-text');

  // Helper: Wait function
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Helper: Find "Load Past Messages" button in the DOM
  function findLoadMoreButton() {
    // 1. Try specific container first
    const containerBtn = document.querySelector('.d-talkroomMessageList_showPastMessages button');
    if (containerBtn && containerBtn.textContent.includes('過去のメッセージを見る')) {
      return containerBtn;
    }
    
    // 2. Fallback: search all buttons on the page by text
    const allButtons = document.querySelectorAll('button');
    for (const b of allButtons) {
      if (b.textContent.includes('過去のメッセージを見る')) {
        return b;
      }
    }
    return null;
  }

  // Load all messages dynamically
  async function expandAllHistory() {
    let clickedCount = 0;
    const maxClicks = 100; // Safety guard limit

    while (clickedCount < maxClicks) {
      const loadBtn = findLoadMoreButton();
      if (!loadBtn) {
        break; // No button found, history is fully loaded
      }

      // If the button is currently disabled/loading, wait a bit
      if (loadBtn.disabled) {
        await sleep(200);
        continue;
      }

      // Update extension UI to display progress
      clickedCount++;
      btnText.textContent = `過去ログ読込中 (${clickedCount}回目)...`;

      // Click the page button to load more history
      loadBtn.click();

      // Wait for the new content to fetch (usually fast, but we give it 1 second)
      await sleep(1000);
    }
  }

  btn.addEventListener('click', async () => {
    try {
      btn.classList.add('csaver-btn-loading');
      btn.disabled = true;

      // 1. Expand all history asynchronously
      btnText.textContent = '初期化中...';
      await expandAllHistory();

      // 2. Parse all messages
      btnText.textContent = 'データ解析中...';
      await sleep(300); // Small UI buffer

      const messages = [];
      const messageEls = document.querySelectorAll('.d-talkroomMessage');

      messageEls.forEach(el => {
        // Sender Name
        const userNameEl = el.querySelector('.d-messageInfo_userName');
        const sender = userNameEl ? userNameEl.textContent.trim() : '不明';

        // Sender Label (e.g. "自動送信", "システムメッセージ")
        const labelEl = el.querySelector('.d-messageInfo_label');
        const label = labelEl ? labelEl.textContent.trim() : null;

        // Post Time
        const postTimeEl = el.querySelector('.d-messageInfo_postTime');
        const postTime = postTimeEl ? postTimeEl.textContent.trim() : '';

        // Message Content & Links
        const mainEl = el.querySelector('.d-talkroomMessage_main');
        let content = '';
        let links = [];

        if (mainEl) {
          const clone = mainEl.cloneNode(true);
          
          // Remove read indicator to keep contents clean
          const readTimeEl = clone.querySelector('.d-talkroomMessage_readTime');
          if (readTimeEl) {
            readTimeEl.remove();
          }

          // Extract URLs / Links
          clone.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href');
            if (href) {
              let absoluteUrl = href;
              if (href.startsWith('/')) {
                absoluteUrl = window.location.origin + href;
              }
              links.push({
                text: a.textContent.trim(),
                url: absoluteUrl
              });
            }
          });

          // Text content
          content = clone.innerText ? clone.innerText.trim() : clone.textContent.trim();
        }

        if (sender !== '不明' || content) {
          messages.push({
            sender,
            label,
            postTime,
            content,
            links: links.length > 0 ? links : undefined
          });
        }
      });

      if (messages.length === 0) {
        alert('保存するメッセージが見つかりませんでした。');
        btn.classList.remove('csaver-btn-loading');
        btnText.textContent = 'JSON保存';
        btn.disabled = false;
        return;
      }

      // 3. Trigger Download
      const jsonString = JSON.stringify(messages, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      // Extract talkroom ID from pathname
      const pathParts = window.location.pathname.split('/');
      const talkroomIndex = pathParts.indexOf('talkrooms');
      const talkroomId = (talkroomIndex !== -1 && pathParts[talkroomIndex + 1]) 
        ? pathParts[talkroomIndex + 1] 
        : 'unknown';

      // Timestamps
      const now = new Date();
      const formattedDate = now.getFullYear() +
        ('0' + (now.getMonth() + 1)).slice(-2) +
        ('0' + now.getDate()).slice(-2) + '_' +
        ('0' + now.getHours()).slice(-2) +
        ('0' + now.getMinutes()).slice(-2) +
        ('0' + now.getSeconds()).slice(-2);

      const filename = `coconala_talkroom_${talkroomId}_${formattedDate}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 4. Success visual response
      btn.classList.remove('csaver-btn-loading');
      btn.classList.add('csaver-btn-success');
      btn.innerHTML = `
        <svg class="csaver-icon" viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.58L21,7Z"/>
        </svg>
        <span class="csaver-btn-text">保存完了 (${messages.length}件)</span>
      `;

      setTimeout(() => {
        btn.classList.remove('csaver-btn-success');
        btn.disabled = false;
        btn.innerHTML = `
          <svg class="csaver-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
          </svg>
          <span class="csaver-btn-text">JSON保存</span>
        `;
      }, 3500);

    } catch (error) {
      console.error('Coconala Saver Error:', error);
      alert('保存中にエラーが発生しました: ' + error.message);
      btn.classList.remove('csaver-btn-loading');
      btnText.textContent = 'JSON保存';
      btn.disabled = false;
    }
  });
})();
