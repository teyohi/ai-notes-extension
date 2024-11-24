document.addEventListener('DOMContentLoaded', function() {
  // Retrieve the current authentication status
  chrome.identity.getAuthToken({ interactive: false }, function(token) {
    const connectButton = document.getElementById('connectGoogle');
    if (token) {
      connectButton.textContent = 'Connected to Google Account';
      connectButton.disabled = true;
    }
  });

  // Connect Google account button
  document.getElementById('connectGoogle').addEventListener('click', async () => {
    try {
      const token = await chrome.identity.getAuthToken({ interactive: true });
      if (token) {
        document.getElementById('connectGoogle').textContent = 'Connected to Google Account';
        document.getElementById('connectGoogle').disabled = true;
      }
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  });

  // Open document button
  document.getElementById('openDoc').addEventListener('click', async () => {
    // Retrieve the document ID from storage
    chrome.storage.sync.get(['docId'], function(result) {
      if (result.docId) {
        // Open the Google document
        window.open(`https://docs.google.com/document/d/${result.docId}/edit`, '_blank');
      } else {
        alert('No notes document created yet. Please use the classify feature to create one first.');
      }
    });
  });

  // Display the most recent operation status
  chrome.storage.sync.get(['lastOperation'], function(result) {
    if (result.lastOperation) {
      const statusDiv = document.querySelector('.status');
      const p = document.createElement('p');
      p.textContent = `Last Operation: ${result.lastOperation}`;
      statusDiv.appendChild(p);
    }
  });
});