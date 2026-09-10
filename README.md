const mineflayer = require('mineflayer');

/**
 * Creates one managed AFK bot for a single account.
 * Handles: microsoft auth, anti-AFK movement, auto-reconnect, live state.
 * Calls onUpdate(state) whenever anything changes.
 */
function createBot(account, settings, onUpdate) {
  const name = account.label || account.username;

  const state = {
    username: account.username,
    label: name,
    status: 'connecting',   // connecting | online | offline | kicked | error | stopped
    health: null,
    food: null,
    pos: null,
    lastChat: '',
    connectedAt: null,
    uptime: 0,
    reconnects: 0,
    error: null,
  };

  let bot = null;
  let antiAfkTimer = null;
  let reconnectTimer = null;
  let manualStop = false;

  const push = () => onUpdate({ ...state });
  const log = (m) => console.log(`[${name}] ${m}`);

  function startAntiAfk() {
    stopAntiAfk();
    const every = (settings.antiAfkIntervalSec || 40) * 1000;
    antiAfkTimer = setInterval(() => {
      if (!bot || !bot.entity) return;
      try {
        bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * Math.PI, false);
        bot.setControlState('jump', true);
        setTimeout(() => bot && bot.setControlState('jump', false), 500);
        const dirs = ['forward', 'back', 'left', 'right'];
        const d = dirs[Math.floor(Math.random() * dirs.length)];
        bot.setControlState(d, true);
        setTimeout(() => bot && bot.setControlState(d, false), 700);
        if (settings.antiAfkCommand) bot.chat(settings.antiAfkCommand);
      } catch (_) {}
    }, every);
  }
  function stopAntiAfk() {
    if (antiAfkTimer) clearInterval(antiAfkTimer);
    antiAfkTimer = null;
  }

  function scheduleReconnect() {
    if (manualStop || reconnectTimer) return;
    state.reconnects += 1;
    push();
    const delay = (settings.reconnectDelaySec || 15) * 1000;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    state.status = 'connecting';
    state.error = null;
    push();

    bot = mineflayer.createBot({
      host: settings.host,
      port: settings.port || 25565,
      username: account.username,
      auth: 'microsoft',
      version: settings.version || false,
      profilesFolder: settings.profilesFolder || './auth-cache',
      hideErrors: false,
    });

    bot.on('login', () => {
      state.status = 'online';
      state.connectedAt = Date.now();
      log('logged in');
      push();
    });

    bot.on('spawn', () => {
      state.status = 'online';
      startAntiAfk();
      if (settings.joinCommands) {
        settings.joinCommands.forEach((c, i) => setTimeout(() => { try { bot.chat(c); } catch (_) {} }, 1500 + i * 1200));
      }
      push();
    });

    bot.on('health', () => {
      state.health = Math.round(bot.health);
      state.food = Math.round(bot.food);
      push();
    });

    bot.on('move', () => {
      if (bot.entity) {
        const p = bot.entity.position;
        state.pos = { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) };
      }
    });

    bot.on('message', (json) => {
      const t = json.toString().trim();
      if (t) { state.lastChat = t.slice(0, 140); push(); }
    });

    bot.on('death', () => {
      log('died');
      if (settings.respawn !== false) { try { bot.chat('/respawn'); } catch (_) {} }
    });

    bot.on('kicked', (reason) => {
      state.status = 'kicked';
      state.error = String(reason).slice(0, 220);
      log('kicked: ' + state.error);
      stopAntiAfk();
      push();
      scheduleReconnect();
    });

    bot.on('end', (reason) => {
      state.status = 'offline';
      log('disconnected: ' + reason);
      stopAntiAfk();
      scheduleReconnect();
    });

    bot.on('error', (err) => {
      state.status = 'error';
      state.error = String(err.message || err).slice(0, 220);
      log('error: ' + state.error);
      push();
    });
  }

  // uptime ticker
  setInterval(() => {
    if (state.status === 'online' && state.connectedAt) {
      state.uptime = Math.floor((Date.now() - state.connectedAt) / 1000);
      push();
    }
  }, 5000);

  connect();

  return {
    getState: () => ({ ...state }),
    reconnect: () => { manualStop = false; if (bot) { try { bot.end(); } catch (_) {} } else connect(); },
    stop: () => {
      manualStop = true;
      stopAntiAfk();
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (bot) { try { bot.quit(); } catch (_) {} }
      state.status = 'stopped';
      push();
    },
    start: () => { manualStop = false; connect(); },
  };
}

module.exports = { createBot };
