import {
  initCryptoKey,
  decryptText
} from './cryptoUtils.js';

let realApiKey = '';

document.addEventListener('DOMContentLoaded', async () => {
  await initCryptoKey(); // ensure key is ready

  const sendBtn = document.getElementById('sendBtn');
  const inputEl = document.getElementById('userInput');
  const chatBox = document.getElementById('chatBox');
  const clearBtn = document.getElementById('clearHistoryBtn');

  // Load encrypted API key and personality
  chrome.storage.local.get(['encryptedApiKey', 'iv', 'personality'], async (data) => {
    if (data.encryptedApiKey && data.iv) {
      try {
        realApiKey = await decryptText(data.encryptedApiKey, data.iv);
      } catch (err) {
        appendMessage('assistant', '❌ Failed to load your API key. Please re-save it in settings.');
        return;
      }
    }
  });

  // Load history
  chrome.storage.local.get(['chatHistory'], (data) => {
    const history = data.chatHistory || [];
    history.forEach(({ sender, text }) => {
      appendMessage(sender, text);
    });
  });

  // Clear history
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove('chatHistory', () => {
      chatBox.innerHTML = '';
    });
  });

  // Send message
  sendBtn.addEventListener('click', async () => {
    const userMessage = inputEl.value.trim();
    if (!userMessage) return;

    appendMessage('user', userMessage);
    saveMessage('user', userMessage);
    inputEl.value = '';

    chrome.storage.local.get(['personality'], async (data) => {
      const personality = data.personality || 'friendly and helpful';

      if (!realApiKey) {
        appendMessage('assistant', '❌ API Key not set. Go to settings.');
        saveMessage('assistant', '❌ API Key not set. Go to settings.');
        return;
      }

      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${realApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `You are a helpful assistant. Be ${personality}.`
              },
              {
                role: 'user',
                content: userMessage
              }
            ]
          })
        });

        const json = await res.json();
        const assistantMsg = json.choices?.[0]?.message?.content || '[No response]';

        appendMessage('assistant', assistantMsg);
        saveMessage('assistant', assistantMsg);
      } catch (err) {
        appendMessage('assistant', `⚠️ Error: ${err.message}`);
        saveMessage('assistant', `⚠️ Error: ${err.message}`);
      }
    });
  });

  function appendMessage(sender, text) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${sender}`;
    wrapper.textContent = text;
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function saveMessage(sender, text) {
    chrome.storage.local.get(['chatHistory'], (data) => {
      const history = data.chatHistory || [];
      history.push({ sender, text });
      chrome.storage.local.set({ chatHistory: history });
    });
  }
});
