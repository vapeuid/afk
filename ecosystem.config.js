# Signal AFK — headless multi-account Minecraft AFK + phone dashboard

Runs any number of Microsoft-auth Minecraft accounts as AFK bots on a VPS
(anti-AFK movement, auto-reconnect) and serves a phone-friendly dashboard
showing each account's status, health, position, uptime, reconnects, and last
chat — with Reconnect / Stop buttons.

## 1. VPS setup (Ubuntu 22.04+)
```bash
sudo apt update && sudo apt install -y nodejs npm git
node -v            # need Node 18+; if older, install Node 20:
# curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs

git clone <your repo> signal-afk   # or upload this folder
cd signal-afk
npm install
cp config.example.json config.json
nano config.json                   # set host, version, password, accounts
```

## 2. config.json
- `host` / `port` — Signal SMP address.
- `version` — the server's MC version string (e.g. "1.21.1"). See the version note below.
- `accounts` — one entry per Microsoft account: `{ "username": "email@x.com", "label": "rcnv" }`.
- `dashboardPassword` — REQUIRED. Anyone with your VPS IP + this password sees/controls the bots.
- `antiAfkIntervalSec` — how often it jiggles (default 40s). `joinCommands` — e.g. `["/afk"]`.

## 3. First run — Microsoft auth (do this once per account)
Auth is device-code based. Run in the foreground and watch the log:
```bash
npm start
```
For each account you'll see:
`[rcnv] To sign in, use a web browser to open https://www.microsoft.com/link and enter the code XXXXXXXX`
Open that on your phone/PC, sign into that account, approve. The token is cached
in `./auth-cache`, so you only do this once per account. Accounts start 4s apart
so the codes don't collide. Once all are logged in, Ctrl+C.

## 4. Run it 24/7 with pm2
```bash
sudo npm install -g pm2
pm2 start src/index.js --name signal-afk
pm2 save
pm2 startup            # run the line it prints, so it survives VPS reboots
pm2 logs signal-afk    # watch output
```

## 5. Open the dashboard on your phone
- Allow the port through the firewall: `sudo ufw allow 3000`
- On your phone browser: `http://<your-vps-ip>:3000`
- Enter the password. It remembers it and auto-connects after that.
- **Add to Home Screen** in your phone browser to make it feel like an app.

Security: the password gates all data/controls, but the port is public. Safer
options: restrict the port to your phone's IP (`sudo ufw allow from <ip> to any
port 3000`), or don't open the port and reach it via an SSH tunnel.

---

## ⚠ Two things that can stop it connecting

**A) Minecraft version support.** mineflayer's protocol support can lag the newest
MC. If `npm start` errors with "unsupported protocol version" for Signal's version:
1. First try `npm install mineflayer@latest` and set `version` to the server's exact version.
2. If still unsupported, run the bots through **ViaProxy** on the same VPS: ViaProxy
   listens locally (e.g. 127.0.0.1:25568) and translates a supported client version up
   to the server's version. Then set `host: "127.0.0.1"`, `port: 25568`, and `version`
   to a version mineflayer *does* support. (ViaProxy: https://github.com/ViaVersion/ViaProxy)

**B) Anti-VPN / "Game Proxy" kick.** VPS/datacenter IPs are often flagged as proxies
by anti-VPN plugins (the same "we don't support Game Proxy networks" kick you can hit
manually). If Signal runs one, the bots get kicked on connect. Fixes: ask Signal staff
to whitelist the VPS IP, or route the VPS through a **residential/ISP proxy** so the
connection looks non-datacenter. If Signal has no anti-VPN (many SMPs don't), you're fine.
