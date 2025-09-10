
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './ChatUI.css';

function ChatUI({ user }) {
  const [showMenu, setShowMenu] = useState(false);
  // Helper to get unique chat ID for two users
  function getChatId(userA, userB) {
    return [userA, userB].sort().join('_');
  }
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const socketRef = useRef(null);
  // Setup socket connection
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:5000/api/chats?username=${user}`)
      .then(res => res.json())
      .then(data => {
        // Each chat has a name (the other user's username)
        setContacts(data.map(chat => ({ name: chat.name, online: true })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  // Fetch messages when selectedContact changes
  // Join chat room and fetch messages when selectedContact changes
  useEffect(() => {
    if (!selectedContact) {
      setMessages([]);
      return;
    }
    const chatId = getChatId(user, selectedContact);
    setMsgLoading(true);
    // Join room
    if (socketRef.current) {
      socketRef.current.emit('join', chatId);
    }
    fetch(`http://localhost:5000/api/messages/${chatId}?username=${user}`)
      .then(res => res.json())
      .then(data => {
        setMessages(data);
        setMsgLoading(false);
      })
      .catch(() => setMsgLoading(false));
  }, [selectedContact, user]);

  // Listen for new messages
  useEffect(() => {
    if (!socketRef.current || !selectedContact) return;
    const chatId = getChatId(user, selectedContact);
    const handler = (msg) => {
      if (msg.chat === chatId) {
        setMessages((prev) => [...prev, msg]);
      }
    };
    socketRef.current.on('new_message', handler);
    return () => {
      socketRef.current.off('new_message', handler);
    };
  }, [selectedContact, user]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (input.trim() && selectedContact) {
      const chatId = getChatId(user, selectedContact);
      try {
        const res = await fetch('http://localhost:5000/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat: chatId, sender: user, text: input })
        });
        if (res.ok) {
          const msg = await res.json();
          setMessages([...messages, msg]);
          setInput('');
        }
      } catch (err) {}
    }
  };

  // Delete chat handler
  // (Removed duplicate handleDeleteChat)
    // Delete chat handler (per-user)
    const handleDeleteChat = async () => {
      if (!selectedContact) return;
      await fetch('http://localhost:5000/api/messages/deleteForUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: getChatId(user, selectedContact), username: user })
      });
      setSelectedContact(null);
      setShowMenu(false);
      // No need to refresh contacts, just clear messages for this chat
    };

  return (
    <div className="wa-container">
      <aside className="wa-sidebar">
        <div className="wa-profile">
          <div className="wa-avatar">{user[0]?.toUpperCase()}</div>
          <span className="wa-username">{user}</span>
        </div>
        <div className="wa-search-row">
          <input
            type="text"
            className="wa-search-box"
            placeholder="Search chats..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="wa-add-btn" title="Start new chat" onClick={() => setShowCreate(true)}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17.25V21h3.75l11.06-11.06a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L3 17.25z" fill="white"/>
              <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="white"/>
            </svg>
          </button>
        </div>
        {showCreate && (
          <div className="wa-create-chat-modal">
            <input
              type="text"
              placeholder="Enter username to chat"
              value={newChatName}
              onChange={e => setNewChatName(e.target.value)}
            />
            <div className="wa-create-chat-actions">
              <button
                className="wa-create-btn"
                onClick={async () => {
                  setCreateError('');
                  if (newChatName && !contacts.some(c => c.name.toLowerCase() === newChatName.toLowerCase())) {
                    try {
                      const res = await fetch('http://localhost:5000/api/chats', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: newChatName })
                      });
                      if (res.ok) {
                        const chat = await res.json();
                        setContacts([...contacts, chat]);
                        setSelectedContact(chat.name);
                        setShowCreate(false);
                        setNewChatName('');
                        setCreateError('');
                      } else {
                        const errData = await res.json();
                        setCreateError(errData.error || 'Failed to create chat');
                      }
                    } catch (err) {
                      setCreateError('Network error');
                    }
                  } else {
                    setCreateError('Chat already exists or name is empty');
                  }
                }}
              >Create</button>
              <button className="wa-cancel-btn" onClick={() => { setNewChatName(''); setShowCreate(false); setCreateError(''); }}>Cancel</button>
            </div>
            {createError && (
              <div style={{ color: 'red', marginTop: '8px', fontSize: '0.95rem' }}>{createError}</div>
            )}
          </div>
        )}
        <ul className="wa-contacts-list">
          {loading ? (
            <li className="wa-loading">Loading...</li>
          ) : contacts.length === 0 ? (
            <li className="wa-empty">No chats yet</li>
          ) : (
            contacts
              .filter(contact => contact.name.toLowerCase().includes(search.toLowerCase()))
              .map((contact) => (
                <li
                  key={contact.name}
                  className={selectedContact === contact.name ? 'wa-selected' : ''}
                  onClick={() => setSelectedContact(contact.name)}
                >
                  <span className={contact.online ? 'wa-online-dot' : 'wa-offline-dot'}></span>
                  <span className="wa-contact-name">{contact.name}</span>
                </li>
              ))
          )}
        </ul>
      </aside>
      <main className="wa-chat-area">
        <header className="wa-chat-header">
          {selectedContact ? (
            <>
              <div className="wa-chat-avatar">{selectedContact[0]?.toUpperCase()}</div>
              <span className="wa-chat-contact">{selectedContact}</span>
              <div style={{ flex: 1 }} />
              <div style={{ position: 'relative' }}>
                <button
                  className="wa-more-btn"
                  title="More"
                  onClick={() => setShowMenu((v) => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="5" cy="12" r="2"/>
                    <circle cx="12" cy="12" r="2"/>
                    <circle cx="19" cy="12" r="2"/>
                  </svg>
                </button>
                {showMenu && (
                  <div className="wa-more-menu" style={{ position: 'absolute', right: 0, top: 36, background: '#fff', color: '#222', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10 }}>
                    <button
                      style={{ padding: '10px 24px', background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: '#d32f2f', fontWeight: 500, borderRadius: 8 }}
                      onClick={handleDeleteChat}
                    >
                      Delete Chat
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <span className="wa-chat-contact wa-no-chat">No chat selected</span>
          )}
        </header>
  <section className="wa-message-list" onClick={() => setShowMenu(false)}>
          {msgLoading ? (
            <div className="wa-empty-msg">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="wa-empty-msg">No messages yet</div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={msg._id || idx}
                className={msg.sender === user ? 'wa-message wa-user' : 'wa-message wa-other'}
              >
                <span style={{ fontSize: '0.85em', color: '#888', marginRight: 6 }}>
                  {msg.sender !== user ? msg.sender : ''}
                </span>
                {msg.text}
              </div>
            ))
          )}
        </section>
        <form className="wa-send-message-form" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!selectedContact ? true : false}
            autoFocus={!!selectedContact}
          />
          <button type="submit" disabled={!selectedContact ? true : false}>Send</button>
        </form>
      </main>
    </div>
  );
}

export default ChatUI;
