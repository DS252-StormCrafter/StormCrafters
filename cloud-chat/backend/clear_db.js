
import mongoose from 'mongoose';

await mongoose.connect('mongodb://10.81.30.75:27017/chat_whatsapp', { useNewUrlParser: true, useUnifiedTopology: true });

const Chat = mongoose.model('Chat', new mongoose.Schema({}, { strict: false }));
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
const Message = mongoose.model('Message', new mongoose.Schema({}, { strict: false }));

await Chat.deleteMany({});
await User.deleteMany({});
await Message.deleteMany({});

console.log('All chats, users, and messages deleted');
await mongoose.disconnect();