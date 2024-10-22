const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

function addMessage(message, isSent, isError = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isSent ? 'sent' : 'received');
    if (isError) messageElement.classList.add('error');
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        addMessage(message, true);
        messageInput.value = '';
        
        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: message, isSent: true }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            console.log('Message saved:', data);
            
            if (data.aiMessage) {
                addMessage(data.aiMessage.content, false);
            } else {
                console.error('No AI message in response');
                addMessage("Sorry, I couldn't generate a response at this time.", false, true);
            }
        } catch (error) {
            console.error('Error saving message or getting AI response:', error);
            addMessage(`Error: ${error.message}`, false, true);
        }
    }
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function loadMessages() {
    try {
        const response = await fetch('/api/messages');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const messages = await response.json();
        messages.forEach(msg => addMessage(msg.content, msg.is_sent === 1));
    } catch (error) {
        console.error('Error loading messages:', error);
        addMessage(`Error loading messages: ${error.message}`, false, true);
    }
}

loadMessages();