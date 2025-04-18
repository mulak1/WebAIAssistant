import {
  initCryptoKey,
  encryptText,
  decryptText
} from './cryptoUtils.js';

let apiKeyVisible = false;
let realApiKey = '';

function showStatus(message, color = "green") {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = color;
  setTimeout(() => (status.textContent = ""), 2500);
}

function placeCaretAtEnd(el) {
  el.focus();
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

document.addEventListener('DOMContentLoaded', async () => {
  await initCryptoKey(); // Ensure crypto key is ready first

  const apiKeyInput = document.getElementById('apiKey');
  const pasteCatcher = document.getElementById('pasteCatcher');
  const personalitySelect = document.getElementById('personality');
  const toggleBtn = document.getElementById('toggleKeyVisibility');
  const eyeIcon = toggleBtn.querySelector('svg');
  const statusDiv = document.getElementById('status');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testKeyBtn');
  const clearBtn = document.getElementById('clearKeyBtn');

  // Load encrypted values
  chrome.storage.local.get(['encryptedApiKey', 'iv', 'personality'], async (data) => {
    if (data.encryptedApiKey && data.iv) {
      try {
        realApiKey = await decryptText(data.encryptedApiKey, data.iv);
        apiKeyInput.textContent = apiKeyVisible
          ? realApiKey
          : '•'.repeat(realApiKey.length);
      } catch (err) {
        console.error("🔐 Decryption failed, clearing storage...");
        chrome.storage.local.remove(['encryptedApiKey', 'iv']);
        showStatus("⚠️ Saved API key was invalid or corrupt. Please re-enter it.", "red");
        realApiKey = '';
        apiKeyInput.textContent = '';
      }
    }

    if (data.personality) {
      personalitySelect.value = data.personality;
    }
  });

  // Watch real input for pastes (invisible input field)
  pasteCatcher.addEventListener('input', () => {
    if (!apiKeyVisible) {
      realApiKey += pasteCatcher.value;
      pasteCatcher.value = '';
      apiKeyInput.textContent = '•'.repeat(realApiKey.length);
      placeCaretAtEnd(apiKeyInput);
    }
  });

  // Redirect Cmd+V to hidden input
  apiKeyInput.addEventListener('keydown', (e) => {
    if (!apiKeyVisible && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
      pasteCatcher.focus();
    } else if (!apiKeyVisible) {
      if (e.key === 'Backspace') {
        realApiKey = realApiKey.slice(0, -1);
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        realApiKey += e.key;
      }

      setTimeout(() => {
        apiKeyInput.textContent = '•'.repeat(realApiKey.length);
        placeCaretAtEnd(apiKeyInput);
      }, 0);

      e.preventDefault();
    }
  });

  apiKeyInput.addEventListener('input', () => {
    if (apiKeyVisible) {
      realApiKey = apiKeyInput.textContent;
    } else {
      apiKeyInput.textContent = '•'.repeat(realApiKey.length);
      placeCaretAtEnd(apiKeyInput);
    }
  });

  // Toggle visibility
  toggleBtn.addEventListener('click', () => {
    apiKeyVisible = !apiKeyVisible;

    if (apiKeyVisible) {
      apiKeyInput.textContent = realApiKey;
      eyeIcon.setAttribute('fill', '#10b981'); // green
    } else {
      apiKeyInput.textContent = '•'.repeat(realApiKey.length);
      eyeIcon.setAttribute('fill', '#4f46e5'); // purple
    }

    placeCaretAtEnd(apiKeyInput);
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const personality = personalitySelect.value;
    const apiKey = realApiKey.trim();

    if (!apiKey) {
      showStatus("❌ Please enter your API key.", "red");
      return;
    }

    encryptText(apiKey).then(({ iv, cipher }) => {
      chrome.storage.local.set({ encryptedApiKey: cipher, iv, personality }, () => {
        showStatus("✅ Settings saved!");
      });
    });
  });

  // Clear key
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['encryptedApiKey', 'iv', 'personality'], () => {
      realApiKey = '';
      apiKeyInput.textContent = '';
      personalitySelect.value = 'friendly and helpful';
      showStatus("🗑️ API key cleared", "gray");
    });
  });

  // Test key
  testBtn.addEventListener('click', () => {
    const key = realApiKey?.trim();

    if (!key) {
      showStatus("❌ Enter your API key first.", "red");
      return;
    }

    showStatus("⏳ Testing...", "#555");

    fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`
      }
    })
      .then((res) => {
        if (res.ok) {
          showStatus("✅ API key is valid!", "green");
        } else {
          showStatus(`❌ Invalid key (HTTP ${res.status})`, "red");
        }
      })
      .catch((err) => {
        showStatus(`❌ Error: ${err.message}`, "red");
      });
  });
});

