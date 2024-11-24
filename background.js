// background.js
let docId = null;
const OPENAI_API_KEY = ''; // Replace with your OpenAI API key

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "classifyText",
    title: "Classify and Save to Google Docs",
    contexts: ["selection"]
  });
});

// Handle AI classification
async function classifyText(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            "role": "system",
            "content": "You are a text classification assistant. Analyze the input text and return a concise classification label (e.g., technology, literature, science, history) and a brief explanation. Return the result in JSON format containing 'category' and 'explanation' fields."
          },
          {
            "role": "user",
            "content": text
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    let result;
    try {
      // Attempt to parse the JSON string returned by the AI
      result = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      // If JSON parsing fails, use the raw response content
      result = {
        category: "Uncategorized",
        explanation: data.choices[0].message.content
      };
    }
    
    // Save the last operation status
    chrome.storage.sync.set({
      lastOperation: `Classification completed: ${result.category}`
    });

    return result;

  } catch (error) {
    console.error('Error during AI classification:', error);
    return {
      category: "Error",
      explanation: "An error occurred during classification. Please try again later."
    };
  }
}

// Modify event listener
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "classifyText") {
    try {
      // Update the status
      await chrome.storage.sync.set({
        lastOperation: "Processing..."
      });

      const classification = await classifyText(info.selectionText);
      const docUrl = await saveToGoogleDocs(info.selectionText, classification);
      
      // Add a delay and handle errors when opening a new tab
      if (docUrl) {
        setTimeout(async () => {
          try {
            await chrome.tabs.create({ url: docUrl });
          } catch (error) {
            console.error('Failed to open document tab:', error);
            // Store the document URL in storage
            await chrome.storage.sync.set({
              lastDocUrl: docUrl,
              lastOperation: `Document saved, but couldn't open automatically. URL: ${docUrl}`
            });
          }
        }, 1000); // 1-second delay
      }
    } catch (error) {
      console.error('Processing failed:', error);
      await chrome.storage.sync.set({
        lastOperation: `Processing failed: ${error.message}`
      });
    }
  }
});

// Modify saveToGoogleDocs function to add more error handling
async function saveToGoogleDocs(text, classification) {
  try {
    console.log('Starting to save to Google Docs...');
    
    // Get the token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
    
    console.log('Successfully obtained token');

    // Attempt to retrieve the existing docId from storage
    const storedData = await chrome.storage.sync.get('docId');
    docId = storedData.docId || null;

    if (!docId) {
      console.log('Creating a new document...');
      const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'AI Classification Notes'
        })
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Create document response:', await createResponse.text());
        throw new Error(`Document creation failed: ${createResponse.status}, ${errorText}`);
      }

      const doc = await createResponse.json();
      console.log('New document created successfully:', doc);
      docId = doc.documentId;
      
      // Save the document ID to storage
      await chrome.storage.sync.set({ docId: docId });
      console.log('Document ID saved:', docId);
    }

    console.log('Preparing to update document content...');
    const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: `Category: ${classification.category}\nExplanation: ${classification.explanation}\nContent: ${text}\n\n---\n\n`
            }
          }
        ]
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Update document response:', errorText);
      // If the update fails, clear the stored docId to create a new document next time
      await chrome.storage.sync.remove('docId');
      throw new Error(`Document update failed: ${updateResponse.status}, ${errorText}`);
    }

    console.log('Document updated successfully');
    await chrome.storage.sync.set({
      lastOperation: `Saved to Google Docs`,
      lastDocUrl: `https://docs.google.com/document/d/${docId}/edit`
    });

    return `https://docs.google.com/document/d/${docId}/edit`;

  } catch (error) {
    console.error('Error saving to Google Docs:', error);
    // If an error occurs, clear the stored docId
    await chrome.storage.sync.remove('docId');
    await chrome.storage.sync.set({
      lastOperation: `Save failed: ${error.message}`
    });
    throw error;
  }
}