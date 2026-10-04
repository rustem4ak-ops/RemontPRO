const maxHandler = require('./max.js');

function normalizeUpdate(raw) {
  const update = raw && typeof raw === 'object' ? { ...raw } : {};
  const message = update.message ? { ...update.message } : null;
  const recipient = message?.recipient || {};

  if (update.update_type === 'message_created' && message) {
    const isGroupOrChannel =
      recipient.chat_type === 'chat' ||
      recipient.chat_type === 'channel';

    if (!isGroupOrChannel) {
      const userId =
        message.sender?.user_id ||
        update.user?.user_id;

      if (userId) update.chat_id = userId;
    }
  }

  if (update.update_type === 'message_callback') {
    const callback = update.callback || update.message_callback || {};
    const callbackUserId =
      callback.user?.user_id ||
      update.user?.user_id ||
      callback.message?.sender?.user_id ||
      update.message?.sender?.user_id;

    const callbackChatType =
      callback.message?.recipient?.chat_type ||
      update.message?.recipient?.chat_type ||
      '';

    if (callbackChatType !== 'chat' && callbackChatType !== 'channel' && callbackUserId) {
      update.chat_id = callbackUserId;
    }
  }

  update.message = message || update.message;
  return update;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return maxHandler(req, res);

  const originalBody = req.body;
  const raw = typeof originalBody === 'string'
    ? JSON.parse(originalBody || '{}')
    : (originalBody || {});

  req.body = normalizeUpdate(raw);
  return maxHandler(req, res);
};
