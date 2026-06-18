(function() {
  // Global state variables
  let isProcessing = false;
  let isDirectMessagePage = false;
  let isTalkroomPage = false;

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

  // Reset button state
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

  // Dynamic pagination finder
  function findLoadMoreButton() {
    if (isDirectMessagePage) {
      // Direct Message "過去のメッセージを読み込む" button
      const dmBtn = document.querySelector('.js_read-more-message');
      if (dmBtn && dmBtn.textContent.includes('過去のメッセージを読み込む') && dmBtn.offsetParent !== null) {
        return dmBtn;
      }
    } else {
      // Talkroom "過去のメッセージを見る" button
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
    }
    return null;
  }

  // Loop expand history
  async function expandAllHistory(btnText) {
    let clickedCount = 0;
    const maxClicks = 100;

    while (clickedCount < maxClicks) {
      const loadBtn = findLoadMoreButton();
      if (!loadBtn) break;

      // Handle direct message load triggers if it shows loading class
      if (isDirectMessagePage && loadBtn.classList.contains('is-loading')) {
        await sleep(200);
        continue;
      }

      // Handle talkroom disabled buttons
      if (!isDirectMessagePage && loadBtn.disabled) {
        await sleep(200);
        continue;
      }

      clickedCount++;
      if (btnText) {
        btnText.textContent = `過去ログ読込中 (${clickedCount}回目)...`;
      }

      loadBtn.click();
      await sleep(1300); // Wait 1.3 seconds for server Ajax
    }
  }

  // Main Download Trigger
  async function handleDownload() {
    const btn = document.getElementById('csaver-download-btn');
    if (!btn || isProcessing) return;

    const btnText = btn.querySelector('.csaver-btn-text');
    if (!btnText) return;

    try {
      isProcessing = true;
      btn.classList.add('csaver-btn-loading');
      btn.disabled = true;

      // 1. Expand history
      btnText.textContent = '初期化中...';
      await expandAllHistory(btnText);

      // 2. Parse Messages based on page type
      btnText.textContent = 'データ解析中...';
      await sleep(300);

      const messages = [];

      if (isDirectMessagePage) {
        // --- PARSING DIRECT MESSAGES (DM) ---
        const wrapper = document.getElementById('threadWrapper');
        if (wrapper) {
          const childEls = wrapper.children;
          for (const el of childEls) {
            try {
              if (el.classList.contains('threadColomun')) {
                // User Message
                const userNameEl = el.querySelector('.threadUserName');
                const sender = userNameEl ? userNameEl.textContent.trim() : '不明';

                const postTimeEl = el.querySelector('.threadPostTime');
                const postTime = postTimeEl ? postTimeEl.textContent.trim() : '';

                const msgEl = el.querySelector('.threadMessage');
                let content = '';
                let links = [];

                if (msgEl) {
                  const clone = msgEl.cloneNode(true);
                  
                  // Extract urls
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

                  // Extract text preferring original text without translation overlay
                  const originalMsgEl = clone.querySelector('.js-translateMessageOriginalMessage');
                  if (originalMsgEl) {
                    content = originalMsgEl.innerText ? originalMsgEl.innerText.trim() : originalMsgEl.textContent.trim();
                  } else {
                    content = clone.innerText ? clone.innerText.trim() : clone.textContent.trim();
                  }
                }

                if (sender !== '不明' || content) {
                  messages.push({
                    type: 'message',
                    sender,
                    postTime,
                    content,
                    links: links.length > 0 ? links : undefined
                  });
                }
              } else if (el.classList.contains('threadNotice')) {
                // System Notice
                const content = el.textContent.trim();
                if (content) {
                  messages.push({
                    type: 'notice',
                    sender: 'システム',
                    content
                  });
                }
              }
            } catch (dmError) {
              console.warn('[Coconala Saver] Skipping DM message node due to parsing issue:', dmError);
            }
          }
        }
      } else {
        // --- PARSING TALKROOM MESSAGES ---
        const messageEls = document.querySelectorAll('.d-talkroomMessage');
        messageEls.forEach((el, index) => {
          try {
            const userNameEl = el.querySelector('.d-messageInfo_userName');
            const sender = userNameEl ? userNameEl.textContent.trim() : '不明';

            const labelEl = el.querySelector('.d-messageInfo_label');
            const label = labelEl ? labelEl.textContent.trim() : null;

            const postTimeEl = el.querySelector('.d-messageInfo_postTime');
            const postTime = postTimeEl ? postTimeEl.textContent.trim() : '';

            const mainEl = el.querySelector('.d-talkroomMessage_main');
            let content = '';
            let links = [];

            if (mainEl) {
              const clone = mainEl.cloneNode(true);
              const readTimeEl = clone.querySelector('.d-talkroomMessage_readTime');
              if (readTimeEl) {
                readTimeEl.remove();
              }

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
                type: 'message',
                sender,
                label: label || undefined,
                postTime,
                content,
                links: links.length > 0 ? links : undefined
              });
            }
          } catch (trError) {
            console.warn(`[Coconala Saver] Skipping talkroom message node index ${index} due to parsing issue:`, trError);
          }
        });
      }

      if (messages.length === 0) {
        alert('保存するメッセージが見つかりませんでした。');
        resetButton(btn, btnText);
        return;
      }

      // 3. Packaging file and triggering download
      const jsonString = JSON.stringify(messages, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      // File name formatting based on page type
      const pathParts = window.location.pathname.split('/');
      let prefix = 'coconala_talkroom';
      let pageId = 'unknown';

      if (isDirectMessagePage) {
        prefix = 'coconala_dm';
        const dmIndex = pathParts.indexOf('direct_message');
        if (dmIndex !== -1 && pathParts[dmIndex + 1]) {
          pageId = pathParts[dmIndex + 1];
        }
      } else {
        prefix = 'coconala_talkroom';
        const talkroomIndex = pathParts.indexOf('talkrooms');
        if (talkroomIndex !== -1 && pathParts[talkroomIndex + 1]) {
          pageId = pathParts[talkroomIndex + 1];
        }
      }

      const now = new Date();
      const formattedDate = now.getFullYear() +
        ('0' + (now.getMonth() + 1)).slice(-2) +
        ('0' + now.getDate()).slice(-2) + '_' +
        ('0' + now.getHours()).slice(-2) +
        ('0' + now.getMinutes()).slice(-2) +
        ('0' + now.getSeconds()).slice(-2);

      const filename = `${prefix}_${pageId}_${formattedDate}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 4. Success layout indicator
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
      console.error('[Coconala Saver] Failed:', error);
      alert('保存中にエラーが発生しました: ' + error.message);
      resetButton(btn, btnText);
    }
  }

  // Sleep Helper
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Dynamic page check
  function checkPageStatus() {
    isDirectMessagePage = window.location.pathname.includes('/direct_message/') || 
                         (window.location.pathname.includes('test_environment.html') && window.location.hash === '#direct_message');
    
    isTalkroomPage = window.location.pathname.includes('/talkrooms/') || 
                     (window.location.pathname.includes('test_environment.html') && window.location.hash !== '#direct_message');

    if (isTalkroomPage || isDirectMessagePage) {
      createFooter();
    } else {
      removeFooter();
    }
  }

  // SPA-friendly checker loop
  setInterval(checkPageStatus, 1000);
  checkPageStatus();

})();
