// ...existing code...
// Get all users

import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
app.get('/api/users', async (req, res) => {
  const users = await User.find({}, { username: 1, _id: 0 });
  res.json(users.map(u => u.username));
});
app.use(express.json());
app.use(cors());
// Socket.IO connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join', (chat) => {
    socket.join(chat);
  });
});

// MongoDB connection
mongoose.connect('mongodb://10.81.30.77:27017/chat_whatsapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const chatSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  online: { type: Boolean, default: true },
});

const User = mongoose.model('User', userSchema);
const Chat = mongoose.model('Chat', chatSchema);

const messageSchema = new mongoose.Schema({
  chat: { type: String, required: true }, // chat name
  sender: { type: String, required: true }, // username
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  deletedBy: { type: [String], default: [] } // usernames who deleted this message
});
const Message = mongoose.model('Message', messageSchema);
// Send a message
app.post('/api/messages', async (req, res) => {
  let { chat, sender, text } = req.body;
  if (!chat || !sender || !text) return res.status(400).json({ error: 'Missing fields' });
  // Ensure chat ID is always sorted
  const users = chat.split('_');
  if (users.length === 2) {
    chat = [users[0], users[1]].sort().join('_');
  }
  try {
    const msg = new Message({ chat, sender, text });
    await msg.save();
    io.to(chat).emit('new_message', msg);
    res.status(201).json(msg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get messages for a chat, excluding those deleted by the user
app.get('/api/messages/:chat', async (req, res) => {
  let { chat } = req.params;
  const { username } = req.query;
  // Ensure chat ID is always sorted
  const users = chat.split('_');
  if (users.length === 2) {
    chat = [users[0], users[1]].sort().join('_');
  }
  let query = { chat };
  if (username) {
    query.deletedBy = { $ne: username };
  }
  const messages = await Message.find(query).sort({ timestamp: 1 });
  res.json(messages);
});

// Delete all messages in a chat for a user (per-user chat deletion)
app.post('/api/messages/deleteForUser', async (req, res) => {
  const { chat, username } = req.body;
  if (!chat || !username) return res.status(400).json({ error: 'chat and username required' });
  // Ensure chat ID is always sorted
  const users = chat.split('_');
  let chatId = chat;
  if (users.length === 2) {
    chatId = [users[0], users[1]].sort().join('_');
  }
  await Message.updateMany(
    { chat: chatId, deletedBy: { $ne: username } },
    { $push: { deletedBy: username } }
  );
  res.json({ message: 'Chat deleted for user.' });
});

// Get all chats
app.get('/api/chats', async (req, res) => {
  const chats = await Chat.find();
  res.json(chats);
});



// Create a new chat
app.post('/api/chats', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  // Check if user exists
  const user = await User.findOne({ username: name });
  if (!user) {
    return res.status(404).json({ error: 'User does not exist.' });
  }
  try {
    const chat = new Chat({ name });
    await chat.save();
    res.status(201).json(chat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Signup route
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(409).json({ message: 'Username already exists.' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword });
  await user.save();
  res.status(201).json({ message: 'User registered successfully.' });
});

// Login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }
  res.json({ message: 'Login successful.' });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running with Socket.IO on port ${PORT}`);
});
