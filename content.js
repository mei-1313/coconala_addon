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
          <span>JSON保存</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const btn = document.getElementById('csaver-download-btn');
  btn.addEventListener('click', () => {
    try {
      btn.classList.add('csaver-btn-loading');
      btn.disabled = true;

      const messages = [];
      // Query all messages (talkroom default or list items)
      const messageEls = document.querySelectorAll('.d-talkroomMessage');

      messageEls.forEach(el => {
        // 1. Sender (User Name)
        const userNameEl = el.querySelector('.d-messageInfo_userName');
        const sender = userNameEl ? userNameEl.textContent.trim() : '不明';

        // 2. Sender Label (e.g. "自動送信", "システムメッセージ")
        const labelEl = el.querySelector('.d-messageInfo_label');
        const label = labelEl ? labelEl.textContent.trim() : null;

        // 3. Post Time
        const postTimeEl = el.querySelector('.d-messageInfo_postTime');
        const postTime = postTimeEl ? postTimeEl.textContent.trim() : '';

        // 4. Message Content & Links
        const mainEl = el.querySelector('.d-talkroomMessage_main');
        let content = '';
        let links = [];

        if (mainEl) {
          // Clone node to safely remove elements without affecting the live DOM
          const clone = mainEl.cloneNode(true);
          
          // Remove read-time indicator (既読 info)
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

          // Extract plain text representing the message content
          content = clone.innerText ? clone.innerText.trim() : clone.textContent.trim();
        }

        // Avoid adding empty structural entries if no meaningful info
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
        alert('保存するメッセージが見つかりませんでした。トークルームのページであることを確認してください。');
        btn.classList.remove('csaver-btn-loading');
        btn.disabled = false;
        return;
      }

      // Format JSON
      const jsonString = JSON.stringify(messages, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      // Extract talkroom ID from path
      const pathParts = window.location.pathname.split('/');
      const talkroomIndex = pathParts.indexOf('talkrooms');
      const talkroomId = (talkroomIndex !== -1 && pathParts[talkroomIndex + 1]) 
        ? pathParts[talkroomIndex + 1] 
        : 'unknown';

      // Current formatted date/time for filename uniqueness
      const now = new Date();
      const formattedDate = now.getFullYear() +
        ('0' + (now.getMonth() + 1)).slice(-2) +
        ('0' + now.getDate()).slice(-2) + '_' +
        ('0' + now.getHours()).slice(-2) +
        ('0' + now.getMinutes()).slice(-2) +
        ('0' + now.getSeconds()).slice(-2);

      const filename = `coconala_talkroom_${talkroomId}_${formattedDate}.json`;

      // Trigger Download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show success micro-interaction
      btn.classList.remove('csaver-btn-loading');
      btn.classList.add('csaver-btn-success');
      btn.innerHTML = `
        <svg class="csaver-icon" viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.58L21,7Z"/>
        </svg>
        <span>保存完了 (${messages.length}件)</span>
      `;

      // Revert button status after 3.5s
      setTimeout(() => {
        btn.classList.remove('csaver-btn-success');
        btn.disabled = false;
        btn.innerHTML = `
          <svg class="csaver-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
          </svg>
          <span>JSON保存</span>
        `;
      }, 3500);

    } catch (error) {
      console.error('Coconala Saver Error:', error);
      alert('履歴の保存中にエラーが発生しました: ' + error.message);
      btn.classList.remove('csaver-btn-loading');
      btn.disabled = false;
    }
  });
})();
