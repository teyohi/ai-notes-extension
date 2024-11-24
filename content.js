// content.js
document.addEventListener('mouseup', function() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      chrome.runtime.sendMessage({
        type: 'TEXT_SELECTED',
        text: selectedText
      });
    }
  });
  