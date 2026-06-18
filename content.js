(function() {
  // Global processing state to prevent duplicate clicks and overlap
  let isProcessing = false;

  // Cleanup existing footer UI
  function removeFooter() {
    const existing = document.getElementById('coconala-talkroom-saver-root');
    if (existing) {
      existing.remove();
    }
  }

  // Create and inject the Glassmorphism footer
  function createFooter() {
    if (document.getElementById('coconala-talkroom-saver-root') || isProcessing) return;

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
    btn.addEventListener('click', handleDownload);
  }

  // Reset button layout and enable it again
  function resetButton(btn, btnText) {
    isProcessing = false;
    if (!btn) return;
    btn.disabled = false;
    btn.className = 'csaver-btn';
    btn.innerHTML = `
      <svg class="csaver-icon" viewBox="0 0 24 24" width="18" height="18">
        <path fill="currentColor" d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
      </svg>
      <span class="csaver-btn-text">JSON保存</span>
    `;
  }

  // Core download handler
  async function handleDownload() {
    const btn = document.getElementById('csaver-download-btn');
    if (!btn || isProcessing) return;

    const btnText = btn.querySelector('.csaver-btn-text');
    if (!btnText) return;

    try {
      isProcessing = true;
      btn.classList.add('csaver-btn-loading');
      btn.disabled = true;

      // 1. Dynamically click and load all historical messages
      btnText.textContent = '初期化中...';
      await expandAllHistory(btnText);

      // 2. Parse active talk messages
      btnText.textContent = 'データ解析中...';
      await sleep(300); // UI buffer

      const messages = [];
      const messageEls = document.querySelectorAll('.d-talkroomMessage');

      messageEls.forEach((el, index) => {
        try {
          // Sender
          const userNameEl = el.querySelector('.d-messageInfo_userName');
          const sender = userNameEl ? userNameEl.textContent.trim() : '不明';

          // Label
          const labelEl = el.querySelector('.d-messageInfo_label');
          const label = labelEl ? labelEl.textContent.trim() : null;

          // Post Time
          const postTimeEl = el.querySelector('.d-messageInfo_postTime');
          const postTime = postTimeEl ? postTimeEl.textContent.trim() : '';

          // Content and URLs
          const mainEl = el.querySelector('.d-talkroomMessage_main');
          let content = '';
          let links = [];

          if (mainEl) {
            const clone = mainEl.cloneNode(true);
            
            // Clean up read tags
            const readTimeEl = clone.querySelector('.d-talkroomMessage_readTime');
            if (readTimeEl) {
              readTimeEl.remove();
            }

            // Extract links
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
        } catch (elError) {
          // Gracefully skip failed message nodes without aborting the save process
          console.warn(`[Coconala Saver] Skipping message node index ${index} due to parsing issue:`, elError);
        }
      });

      if (messages.length === 0) {
        alert('保存するメッセージが見つかりませんでした。');
        resetButton(btn, btnText);
        return;
      }

      // 3. Package and trigger the file download
      const jsonString = JSON.stringify(messages, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      // Extract talkroom ID
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

      // 4. Handle success view feedback
      btn.classList.remove('csaver-btn-loading');
      btn.classList.add('csaver-btn-success');
      btn.innerHTML = `
        <svg class="csaver-icon" viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.58L21,7Z"/>
        </svg>
        <span class="csaver-btn-text">保存完了 (${messages.length}件)</span>
      `;

      setTimeout(() => {
        resetButton(btn, null);
      }, 3500);

    } catch (error) {
      console.error('[Coconala Saver] Execution Failed:', error);
      alert('保存中にエラーが発生しました: ' + error.message);
      resetButton(btn, btnText);
    }
  }

  // Sleep helper
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Find target pagination button
  function findLoadMoreButton() {
    const containerBtn = document.querySelector('.d-talkroomMessageList_showPastMessages button');
    if (containerBtn && containerBtn.textContent.includes('過去のメッセージを見る')) {
      return containerBtn;
    }
    const allButtons = document.querySelectorAll('button');
    for (const b of allButtons) {
      if (b.textContent.includes('過去のメッセージを見る')) {
        return b;
      }
    }
    return null;
  }

  // Recursively fetch past history
  async function expandAllHistory(btnText) {
    let clickedCount = 0;
    const maxClicks = 100;

    while (clickedCount < maxClicks) {
      const loadBtn = findLoadMoreButton();
      if (!loadBtn) break;

      if (loadBtn.disabled) {
        await sleep(200);
        continue;
      }

      clickedCount++;
      if (btnText) {
        btnText.textContent = `過去ログ読込中 (${clickedCount}回目)...`;
      }

      loadBtn.click();
      await sleep(1200); // Standardize request wait time to 1.2s
    }
  }

  // Periodic URL and Page Watcher (SPA & Local mock pages dynamic transition support)
  function checkPageStatus() {
    const isTalkroom = window.location.pathname.includes('/talkrooms/') || 
                       window.location.pathname.includes('test_environment.html');
    
    if (isTalkroom) {
      createFooter();
    } else {
      removeFooter();
    }
  }

  // Loop check every 1s
  setInterval(checkPageStatus, 1000);
  // Initial check
  checkPageStatus();

})();
