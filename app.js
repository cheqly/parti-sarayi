/* Parti Sarayı — arayüz ve akış */
(function () {
  const G = window.KhGame;
  const GAMES = window.KH_GAMES;
  const WHEEL = window.KH_WHEEL;
  const SCHEDULE = window.KH_SCHEDULE;
  const AVATARS = ['👸', '🤴', '👑', '🌊', '😎', '🦄', '🐸', '🐼', '🦊', '🐙', '👽', '🤖', '🐯', '🍕', '🌶️', '👑'];
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const $app = document.getElementById('app');

  /* ---------- güvenli localStorage ---------- */
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('partisarayi:' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        if (v == null) localStorage.removeItem('partisarayi:' + k);
        else localStorage.setItem('partisarayi:' + k, JSON.stringify(v));
      } catch (e) {}
    }
  };

  const uid = () => (crypto && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 16);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const makeCode = () => {
    const a = new Uint32Array(6);
    (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 1e9)));
    return Array.from(a, (n) => CODE_CHARS[n % CODE_CHARS.length]).join('');
  };
  const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  /* ---------- uygulama durumu ---------- */
  const profile = store.get('profile', null) || { id: uid(), name: '', avatar: '👑' };
  if (!profile.id) profile.id = uid();
  store.set('profile', profile);

  const ui = {
    screen: 'home', // home | connecting | game | error
    error: '',
    joinCode: '',
    localNames: ['', ''],
    openGame: null,
    showHistory: false,
    showMenu: false,
    showHelp: false,
    sound: store.get('sound', true),
    spun: {}, // çarkı dönmüş kart id'leri
    timerStarts: {},
    timerDone: {},
    lastToast: null,
    pending: null,
    hostAwaySince: null,
    status: 'offline'
  };

  let S = null; // oyun durumu
  let session = null; // { mode, code }
  let room = null; // KhNet.Room
  let presence = {};
  const seenAids = [];

  /* ---------- ses & titreşim ---------- */
  let actx = null;
  function beep(freqs, dur, type, gain) {
    if (!ui.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      let t = actx.currentTime;
      freqs.forEach((f) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type || 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(gain || 0.12, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + dur);
        t += dur * 0.8;
      });
    } catch (e) {}
  }
  const sfx = {
    tap: () => beep([660], 0.06, 'triangle', 0.06),
    draw: () => beep([392, 523, 659], 0.09, 'triangle'),
    win: () => beep([523, 659, 784, 1046], 0.13, 'square', 0.07),
    lose: () => beep([330, 247], 0.18, 'sawtooth', 0.06),
    tick: () => beep([880], 0.05, 'square', 0.04),
    buzz: () => beep([196, 147], 0.35, 'sawtooth', 0.1)
  };
  const vibrate = (p) => {
    try {
      navigator.vibrate && navigator.vibrate(p);
    } catch (e) {}
  };

  /* ---------- ekran açık kalsın ---------- */
  let wakeLock = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => (wakeLock = null));
      }
    } catch (e) {}
  }

  /* ---------- yardımcılar ---------- */
  const me = () => (S ? S.players.find((p) => p.id === profile.id) : null);
  const isLocal = () => S && S.mode === 'local';
  const isHost = () => S && S.hostId === profile.id;
  const P = (id) => (S ? S.players.find((p) => p.id === id) : null);
  const nameOf = (id) => {
    const p = P(id);
    return p ? p.avatar + ' ' + esc(p.name) : '—';
  };
  const opp = () => (S ? S.players.find((p) => p.id !== profile.id) : null);

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 2600);
  }

  /* ---------- aksiyon gönderme ---------- */
  function act(type, payload) {
    if (!S) return;
    sfx.tap();
    const a = Object.assign({ type, by: profile.id, aid: uid() }, payload || {});
    if (isLocal()) {
      // tek telefonda aksiyonu "sıradaki oyuncu" adına uygula
      const tp = G.turnPlayer(S);
      if (a.by === profile.id && tp) a.by = tp.id;
      commit(G.reduce(S, a));
      return;
    }
    if (isHost()) {
      commit(G.reduce(S, a));
      return;
    }
    // misafir: host'a gönder, cevap gelmezse bir kez tekrar dene
    room.send(a);
    const rev = S.rev;
    ui.pending = { aid: a.aid, rev };
    render();
    setTimeout(() => {
      if (ui.pending && ui.pending.aid === a.aid && S && S.rev === rev) room.send(a);
    }, 3000);
    setTimeout(() => {
      if (ui.pending && ui.pending.aid === a.aid && S && S.rev === rev) {
        ui.pending = null;
        render();
        toast('⏳ Oda sahibine ulaşılamadı, tekrar dene.', 'warn');
      }
    }, 7000);
  }

  function commit(next) {
    if (!next || next === S) {
      render();
      return;
    }
    const prev = S;
    S = next;
    if (isLocal()) store.set('local', S);
    else if (room && isHost()) room.publishState(S);
    react(prev, S);
    render();
  }

  // Host: misafirden gelen aksiyonu işle
  function onAction(a) {
    if (!S || !isHost() || !a || a.by === profile.id) return;
    if (a.aid) {
      if (seenAids.includes(a.aid)) return;
      seenAids.push(a.aid);
      if (seenAids.length > 100) seenAids.shift();
    }
    const next = G.reduce(S, a);
    if (next !== S) commit(next);
    else room.publishState(S); // misafirin ekranı güncel kalsın
  }

  function onState(s) {
    if (!s) {
      if (S && ui.screen === 'game') {
        leaveRoom(true);
        showError('Oda kapatıldı. 🎈');
      }
      return;
    }
    if (G.expired(s)) return;
    if (S && s.code === S.code && (s.rev || 0) < (S.rev || 0)) return; // eski durum
    const prev = S;
    S = s;
    if (ui.pending && s.rev !== ui.pending.rev) ui.pending = null;
    react(prev, S);
    render();
  }

  function onPresence(p) {
    presence = p;
    render();
  }

  // Durum değişikliklerine efekt/ses tepkisi
  function react(prev, s) {
    if (!s) return;
    if (prev && s.last && (!prev.last || prev.last.seq !== s.last.seq || prev.last.n !== s.last.n) && s.last.n !== ui.lastToast) {
      ui.lastToast = s.last.n;
      const w = s.last.winner;
      if (w) {
        const p = s.players.find((x) => x.id === w);
        showBurst((p ? p.avatar + ' ' + esc(p.name) : '') + ' <b>+' + s.last.pts + '</b>', s.last.note);
        if (w === profile.id || isLocal()) {
          sfx.win();
          vibrate([40, 40, 80]);
        } else {
          sfx.lose();
          vibrate(60);
        }
      } else if (s.phase === 'play' || s.phase === 'lobby') {
        showBurst('Tur geçti', s.last.note || 'Puan yok 🤝');
      }
    }
    if (s.card && (!prev || !prev.card || prev.card.id !== s.card.id)) {
      sfx.draw();
      vibrate(30);
    }
    if (s.phase === 'final' && (!prev || prev.phase !== 'final')) {
      setTimeout(confetti, 200);
      sfx.win();
    }
    if (prev && prev.phase === 'room' && s.phase === 'lobby') {
      toast('🎉 İkiniz de hazırsınız. Parti başlasın!');
    }
    if (prev && prev.players.length < 2 && s.players.length === 2 && s.phase === 'room') {
      const o = s.players.find((p) => p.id !== profile.id);
      if (o && !isLocal()) toast(o.avatar + ' <b>' + esc(o.name) + '</b> odaya katıldı!');
    }
  }

  /* ---------- oda kurma / katılma ---------- */
  function saveProfileFromInputs() {
    const n = document.getElementById('nameInput');
    if (n) profile.name = n.value.trim().slice(0, 16);
    store.set('profile', profile);
  }

  function needName() {
    saveProfileFromInputs();
    if (!profile.name) {
      toast('✍️ Önce takma adını yaz!', 'warn');
      const n = document.getElementById('nameInput');
      if (n) {
        n.focus();
        n.classList.add('shake');
        setTimeout(() => n.classList.remove('shake'), 500);
      }
      return true;
    }
    return false;
  }

  function makeRoom(code) {
    return new KhNet.Room({
      code,
      me: profile.id,
      onState,
      onAction,
      onPresence,
      onConnect: (client) => {
        // bir sunucuya (yeniden) bağlanınca oda sahibi güncel durumu oraya da yazar
        if (S && room && isHost() && !isLocal()) room.publishState(S, client);
      },
      onStatus: (st, n, total) => {
        ui.status = st;
        ui.links = n + '/' + total;
        updateStatusPill();
      }
    });
  }

  async function createRoom() {
    if (needName()) return;
    if (!window.mqtt) return showError('Bağlantı kütüphanesi yüklenemedi. Sayfayı yenile.');
    const code = makeCode();
    go('connecting', 'Oda kuruluyor…');
    room = makeRoom(code);
    const ok = await room.open();
    if (!ok) {
      room.leave();
      room = null;
      return showError('İnternete bağlanılamadı. Bağlantını kontrol edip tekrar dene. İstersen “Tek Telefonda Oyna” ile hemen başlayabilirsin.');
    }
    S = G.newState({ code, mode: 'online', host: profile });
    session = { mode: 'online', code };
    store.set('session', session);
    room.publishState(S);
    setUrlCode(code);
    ui.screen = 'game';
    keepAwake();
    render();
  }

  async function joinRoom(code, resume) {
    code = cleanCode(code);
    if (code.length !== 6) {
      toast('🔑 Oda kodu 6 karakter olmalı.', 'warn');
      return;
    }
    if (!resume && needName()) return;
    if (!window.mqtt) return showError('Bağlantı kütüphanesi yüklenemedi. Sayfayı yenile.');
    go('connecting', resume ? 'Odaya yeniden bağlanılıyor…' : 'Oda aranıyor…');
    S = null;
    room = makeRoom(code);
    const found = await room.find(6000);
    if (!found || !S || S.code !== code) {
      room.leave();
      room = null;
      S = null;
      if (resume) store.set('session', null);
      return showError('“' + code + '” kodlu oda bulunamadı. Kodu kontrol et ya da arkadaşından yeni link iste.');
    }
    const inRoom = S.players.some((p) => p.id === profile.id);
    if (!inRoom && S.players.length >= 2) {
      room.leave();
      room = null;
      S = null;
      return showError('Bu oda dolu. Parti Sarayı iki kişiliktir 🙂');
    }
    session = { mode: 'online', code };
    store.set('session', session);
    setUrlCode(code);
    ui.screen = 'game';
    keepAwake();
    if (isHost()) {
      // Oda sahibi geri döndü: durumu tekrar yayınla
      room.publishState(S);
    } else {
      act('join', { name: profile.name || 'Oyuncu', avatar: profile.avatar });
    }
    render();
  }

  function startLocal() {
    const a = document.getElementById('local1');
    const b = document.getElementById('local2');
    const n1 = (a && a.value.trim()) || 'Oyuncu 1';
    const n2 = (b && b.value.trim()) || 'Oyuncu 2';
    const avFor = (n, d) => (/ceyda/i.test(n) ? '👸' : /semih/i.test(n) ? '🤴' : d);
    const p1 = { id: 'L1', name: n1, avatar: avFor(n1, '👑') };
    const p2 = { id: 'L2', name: n2, avatar: avFor(n2, '🌊') };
    S = G.newState({ code: 'LOCAL', mode: 'local', host: p1 });
    S.players.push({ id: p2.id, name: n2.slice(0, 16), avatar: p2.avatar, score: 0, ready: true });
    S.players[0].avatar = p1.avatar;
    S.players[0].ready = true;
    S.phase = 'lobby';
    session = { mode: 'local' };
    store.set('session', session);
    store.set('local', S);
    ui.screen = 'game';
    keepAwake();
    render();
  }

  function leaveRoom(silent) {
    if (room) room.leave();
    room = null;
    S = null;
    session = null;
    presence = {};
    store.set('session', null);
    setUrlCode(null);
    ui.screen = 'home';
    ui.showMenu = false;
    ui.pending = null;
    if (!silent) render();
  }

  function closeRoom() {
    if (room && isHost()) room.clearState();
    setTimeout(() => leaveRoom(), 200);
  }

  function setUrlCode(code) {
    try {
      const u = new URL(location.href);
      if (code) u.searchParams.set('oda', code);
      else u.searchParams.delete('oda');
      history.replaceState(null, '', u.toString());
    } catch (e) {}
  }

  function inviteLink() {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('oda', S.code);
    const custom = new URLSearchParams(location.search).get('broker');
    if (custom) u.searchParams.set('broker', custom);
    return u.toString();
  }

  async function share() {
    const link = inviteLink();
    const text = '🎉 Parti Sarayı’na davetlisin! Oda kodu: ' + S.code + '\n' + link;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Parti Sarayı', text: '🎉 Parti Sarayı’na davetlisin! Oda kodu: ' + S.code, url: link });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    copy(text);
  }

  function copy(text) {
    const done = () => toast('📋 Kopyalandı!');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    try {
      document.execCommand('copy');
      done();
    } catch (e) {
      prompt('Kopyala:', text);
    }
    t.remove();
  }

  function go(screen, msg) {
    ui.screen = screen;
    ui.msg = msg || '';
    render();
  }
  function showError(msg) {
    ui.error = msg;
    go('error');
  }

  /* ================= RENDER ================= */
  function render() {
    let html = '';
    if (ui.screen === 'home') html = vHome();
    else if (ui.screen === 'connecting') html = vConnecting();
    else if (ui.screen === 'error') html = vError();
    else if (ui.screen === 'game' && S) html = vGame();
    else html = vHome();
    // Dönmekte olan çarkı yeniden çizimde koru (animasyon bozulmasın)
    const oldWheel = document.getElementById('wheel');
    $app.innerHTML = html;
    const newWheel = document.getElementById('wheel');
    if (oldWheel && newWheel && oldWheel.getAttribute('data-card') === newWheel.getAttribute('data-card')) newWheel.replaceWith(oldWheel);
    afterRender();
  }

  const CROWN =
    '<svg class="crown-svg" viewBox="0 0 64 40" aria-hidden="true"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset="1" stop-color="#d9a032"/></linearGradient></defs>' +
    '<path d="M6 34 L2 10 L18 20 L32 4 L46 20 L62 10 L58 34 Z" fill="url(#cg)"/><rect x="6" y="34" width="52" height="5" rx="2" fill="#d9a032"/>' +
    '<circle cx="32" cy="4" r="3" fill="#ff4f8b"/><circle cx="2" cy="10" r="2.5" fill="#ffe9a3"/><circle cx="62" cy="10" r="2.5" fill="#ffe9a3"/></svg>';
  function logo(small) {
    return '<div class="logo' + (small ? ' small' : '') + '">' + CROWN + '<div class="logo-word">Parti <span>Sarayı</span></div></div>';
  }

  function vHome() {
    const urlCode = cleanCode(ui.joinCode);
    return (
      '<main class="screen home">' +
      '<div class="hero">' +
      logo() +
      '<p class="tagline">Semih &amp; Kraliçe Ceyda’nın gecesi</p><p class="subtag">Bursa 16 <i>❤</i> Tekirdağ 59</p>' +
      '</div>' +
      '<section class="panel">' +
      '<label class="lbl" for="nameInput">Takma adın</label>' +
      '<div class="name-row"><button class="avatar-btn" data-a="avatar" aria-label="Avatar değiştir">' +
      profile.avatar +
      '</button><input id="nameInput" class="input" maxlength="16" autocomplete="off" autocapitalize="words" placeholder="ör. Ceyda" value="' +
      esc(profile.name) +
      '"></div>' +
      '<div class="quick"><span class="muted small">Hızlı seç:</span>' +
      '<button class="chip-btn' + (profile.name === 'Semih' ? ' on' : '') + '" data-a="quick" data-n="Semih" data-av="🤴">🤴 Semih</button>' +
      '<button class="chip-btn' + (profile.name === 'Ceyda' ? ' on' : '') + '" data-a="quick" data-n="Ceyda" data-av="👸">👸 Ceyda</button></div>' +
      '</section>' +
      (urlCode.length === 6
        ? '<section class="panel invite"><div class="invite-title">💌 Davet edildin!</div><div class="code-big">' + esc(urlCode) + '</div><button class="btn btn-primary btn-xl" data-a="join">🚪 Odaya Katıl</button></section>'
        : '') +
      '<section class="panel actions">' +
      '<button class="btn ' + (urlCode.length === 6 ? 'btn-ghost' : 'btn-primary btn-xl') + '" data-a="create">🎉 Oda Kur</button>' +
      '<div class="join-row"><input id="codeInput" class="input code-input" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ODA KODU" value="' +
      esc(urlCode) +
      '"><button class="btn btn-secondary" data-a="join">Katıl</button></div>' +
      '<div class="divider"><span>ya da</span></div>' +
      '<button class="btn btn-ghost" data-a="localSetup">📱 Tek Telefonda Oyna</button>' +
      '</section>' +
      (ui.localSetup
        ? '<section class="panel"><div class="lbl">Tek telefon: oyuncu adları</div>' +
          '<input id="local1" class="input" maxlength="16" placeholder="1. oyuncu" value="' + esc(ui.localNames[0] || 'Semih') + '">' +
          '<input id="local2" class="input" maxlength="16" placeholder="2. oyuncu" value="' + esc(ui.localNames[1] || 'Ceyda') + '">' +
          '<button class="btn btn-primary" data-a="startLocal">▶️ Başla</button></section>'
        : '') +
      '<details class="panel help"><summary>❓ Nasıl oynanır?</summary>' +
      '<ol class="steps"><li><b>Oda Kur</b>a bas, linki WhatsApp’tan arkadaşına gönder.</li>' +
      '<li>Arkadaşın linke dokunur ya da 6 haneli kodu yazar.</li>' +
      '<li>İkiniz de <b>Hazırım</b> deyince lobi açılır, oyunu seçersiniz.</li>' +
      '<li>Sıradaki kart çeker, görev iki ekranda da aynı anda görünür.</li>' +
      '<li>Turu kazanan puanı alır. Hedef puana ilk ulaşan tacı kapar: <b>Sarayın Kraliçesi</b> ya da <b>Sarayın Kralı</b> 👑</li></ol>' +
      '<p class="muted">Sesli/görüntülü konuşma için WhatsApp ya da telefon görüşmesini açık tutun. Her görev reddedilebilir ya da değiştirilebilir.</p>' +
      '</details>' +
      vSchedule() +
      '<details class="panel help" id="netTest"><summary>📡 Bağlantı testi</summary>' +
      '<p class="muted small">Online oda için en az bir sunucuya ulaşabiliyor olman yeterli.</p>' +
      '<div id="netResult" class="net-result">' + (ui.netResult || '') + '</div>' +
      '<button class="btn btn-secondary" data-a="netTest">Testi başlat</button></details>' +
      '<footer class="foot">Parti Sarayı • iki kişilik online parti gecesi</footer>' +
      '</main>'
    );
  }

  function vSchedule() {
    return (
      '<details class="panel help"><summary>🕙 Önerilen gece programı</summary><table class="sched">' +
      SCHEDULE.map((r) => '<tr><td class="t">' + r[0] + '</td><td>' + esc(r[1]) + '</td><td class="d">' + r[2] + '</td></tr>').join('') +
      '</table></details>'
    );
  }

  function vConnecting() {
    return '<main class="screen center">' + logo() + '<div class="spinner"></div><p class="muted">' + esc(ui.msg || 'Bağlanıyor…') + '</p></main>';
  }

  function vError() {
    return (
      '<main class="screen center">' +
      logo(true) +
      '<div class="panel err"><div class="big-emoji">🙈</div><p>' +
      esc(ui.error) +
      '</p><button class="btn btn-primary" data-a="home">🏠 Ana sayfa</button></div></main>'
    );
  }

  /* ---------- oyun içi ---------- */
  function vTopbar() {
    const pill = isLocal() ? '<span class="pill local">📱 Tek telefon</span>' : '<span id="statusPill" class="pill ' + ui.status + '">' + statusText() + '</span>';
    return (
      '<header class="topbar">' +
      logo(true) +
      '<div class="top-right">' +
      pill +
      '<button class="icon-btn" data-a="menu" aria-label="Menü">☰</button></div>' +
      '</header>' +
      (ui.showMenu ? vMenu() : '')
    );
  }

  function statusText() {
    return { online: '● Bağlı', connecting: '● Bağlanıyor', reconnecting: '● Yeniden bağlanıyor', offline: '● Çevrimdışı' }[ui.status] || '●';
  }
  function updateStatusPill() {
    const el = document.getElementById('statusPill');
    if (el) {
      el.className = 'pill ' + ui.status;
      el.textContent = statusText();
      el.title = 'Bağlı sunucu: ' + (ui.links || '-');
    }
  }

  function vMenu() {
    return (
      '<div class="sheet-backdrop" data-a="menu"></div><div class="sheet">' +
      '<button class="btn btn-ghost" data-a="sound">' + (ui.sound ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı') + '</button>' +
      '<button class="btn btn-ghost" data-a="history">📜 Tur geçmişi</button>' +
      (!isLocal() && S ? '<button class="btn btn-ghost" data-a="share">📤 Davet linkini paylaş</button>' : '') +
      (S && (S.phase === 'lobby' || S.phase === 'play') ? '<button class="btn btn-ghost" data-a="finish">🏁 Geceyi bitir, tacı ver 👑</button>' : '') +
      (!isLocal() && isHost() ? '<button class="btn btn-danger" data-a="closeRoom">🧹 Odayı kapat</button>' : '') +
      '<button class="btn btn-danger" data-a="leave">🚪 ' + (isLocal() ? 'Oyunu bitir' : 'Odadan çık') + '</button>' +
      '<button class="btn btn-secondary" data-a="menu">Kapat</button>' +
      '</div>'
    );
  }

  function vScore(compact) {
    const tp = S.phase === 'play' ? G.turnPlayer(S) : null;
    return (
      '<div class="scoreboard' + (compact ? ' compact' : '') + '">' +
      S.players
        .map((p) => {
          const on = isLocal() || p.id === profile.id || presence[p.id];
          const pct = Math.min(100, Math.round((p.score / S.target) * 100));
          return (
            '<div class="sc' + (tp && tp.id === p.id ? ' turn' : '') + (p.id === profile.id && !isLocal() ? ' me' : '') + '">' +
            '<div class="sc-av">' + p.avatar + (isLocal() ? '' : '<i class="dot ' + (on ? 'on' : 'off') + '"></i>') + '</div>' +
            '<div class="sc-body"><div class="sc-name">' + esc(p.name) + (p.id === profile.id && !isLocal() ? ' <small>(sen)</small>' : '') + '</div>' +
            '<div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
            '<div class="sc-pts">' + p.score + '</div></div>'
          );
        })
        .join('<div class="vs">VS</div>') +
      '</div>' +
      '<div class="target">🎯 Hedef: <b>' + S.target + '</b> puan</div>'
    );
  }

  function hostAwayBanner() {
    if (isLocal() || isHost() || !S) return '';
    const hostOn = presence[S.hostId];
    if (hostOn !== false) {
      ui.hostAwaySince = null;
      return '';
    }
    ui.hostAwaySince = ui.hostAwaySince || Date.now();
    const host = P(S.hostId);
    const long = Date.now() - ui.hostAwaySince > 20000;
    return (
      '<div class="banner">📡 ' + (host ? esc(host.name) : 'Oda sahibi') + ' yeniden bağlanıyor…' +
      (long ? ' <button class="btn btn-mini" data-a="takeover">Yönetimi devral</button>' : '') +
      '</div>'
    );
  }

  function vGame() {
    let body = '';
    if (S.phase === 'room') body = vRoom();
    else if (S.phase === 'lobby') body = vLobby();
    else if (S.phase === 'play') body = vPlay();
    else if (S.phase === 'tiebreak') body = vTiebreak();
    else if (S.phase === 'final') body = vFinal();
    return (
      vTopbar() +
      hostAwayBanner() +
      '<main class="screen game phase-' + S.phase + (ui.pending ? ' is-pending' : '') + '">' +
      body +
      '</main>' +
      (ui.showHistory ? vHistory() : '')
    );
  }

  function vRoom() {
    const mine = me();
    const slots = [0, 1]
      .map((i) => {
        const p = S.players[i];
        if (!p) return '<div class="slot empty"><div class="slot-av pulse">❔</div><div class="slot-name">Arkadaşın bekleniyor…</div><div class="muted small">Linki gönder 👇</div></div>';
        const on = p.id === profile.id || presence[p.id];
        return (
          '<div class="slot' + (p.ready ? ' ready' : '') + '"><div class="slot-av">' + p.avatar + '</div>' +
          '<div class="slot-name">' + esc(p.name) + (p.id === profile.id ? ' <small>(sen)</small>' : '') + (p.id === S.hostId ? ' <small>👑 oda sahibi</small>' : '') + '</div>' +
          '<div class="conn ' + (on ? 'on' : 'off') + '">' + (on ? '● bağlı' : '● yeniden bağlanıyor') + '</div>' +
          '<div class="ready-tag">' + (p.ready ? '✅ Hazır' : '⏳ Hazırlanıyor') + '</div></div>'
        );
      })
      .join('');
    return (
      '<section class="panel room-code">' +
      '<div class="lbl">Oda kodu</div>' +
      '<div class="code-big" data-a="copyCode">' + esc(S.code) + '</div>' +
      '<div class="row">' +
      '<button class="btn btn-primary" data-a="share">📤 Davet et</button>' +
      '<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('🎉 Parti Sarayı’na davetlisin! Oda kodu: ' + S.code + '\n' + inviteLink()) + '">💬 WhatsApp</a>' +
      '</div></section>' +
      '<section class="slots">' + slots + '</section>' +
      (mine
        ? '<button class="btn btn-xl ' + (mine.ready ? 'btn-ghost' : 'btn-primary') + '" data-a="ready">' + (mine.ready ? '↩️ Hazır değilim' : '🙌 Hazırım!') + '</button>'
        : '<div class="muted center-text">Odaya katılınıyor…</div>') +
      (S.players.length === 2 && !S.players.every((p) => p.ready) ? '<p class="muted center-text">İkiniz de hazır olunca lobi açılır.</p>' : '') +
      vSettings() +
      '<p class="muted center-text small">Görüntülü ya da sesli görüşmeyi WhatsApp’tan açık tutun 📞</p>'
    );
  }

  function vSettings() {
    const can = isLocal() || isHost();
    const chip = (key, v, cur, label) =>
      '<button class="chip' + (v === cur ? ' on' : '') + '" ' + (can ? 'data-a="set" data-k="' + key + '" data-v="' + v + '"' : 'disabled') + '>' + label + '</button>';
    return (
      '<section class="panel settings">' +
      '<div class="set-row"><span>🎯 Hedef puan</span><div class="chips">' + [3, 5, 10, 15].map((v) => chip('target', v, S.target, v)).join('') + '</div></div>' +
      '<div class="set-row"><span>🔁 Oyun başına tur</span><div class="chips">' + [4, 6, 8, 10].map((v) => chip('rounds', v, S.rounds, v)).join('') + '</div></div>' +
      (can ? '' : '<div class="muted small">Ayarları oda sahibi değiştirebilir.</div>') +
      '</section>'
    );
  }

  function vLobby() {
    const played = S.gamesPlayed || [];
    const cards = GAMES.map((g) => {
      const open = ui.openGame === g.id;
      const count = played.filter((x) => x === g.id).length;
      return (
        '<div class="gcard' + (open ? ' open' : '') + '" style="--c:' + g.color + '">' +
        '<button class="gcard-head" data-a="openGame" data-g="' + g.id + '">' +
        '<span class="g-ico">' + g.icon + '</span><span class="g-txt"><b>' + esc(g.name) + '</b><small>' + esc(g.short) + '</small></span>' +
        (count ? '<span class="g-badge">✓' + (count > 1 ? count : '') + '</span>' : '') +
        '</button>' +
        (open
          ? '<div class="gcard-body"><p>' + esc(g.desc) + '</p><div class="muted small">🔁 ' + S.rounds + ' tur' + (g.timer ? ' • ⏱ ' + g.timer + ' sn' : '') + ' • 🎟️ kişi başı 1 pas</div>' +
            '<button class="btn btn-primary" data-a="pickGame" data-g="' + g.id + '">▶️ Başlat</button></div>'
          : '') +
        '</div>'
      );
    }).join('');
    return (
      vScore() +
      (S.last ? '<div class="last">Son tur: ' + (S.last.winner ? nameOf(S.last.winner) + ' +' + S.last.pts : 'puan yok') + (S.last.note ? ' • ' + esc(S.last.note) : '') + '</div>' : '') +
      '<h2 class="h2">🕹️ Oyununu seç</h2>' +
      '<section class="games">' + cards + '</section>' +
      vSettings() +
      '<button class="btn btn-ghost" data-a="finish">🏁 Geceyi bitir, tacı ver 👑</button>' +
      vSchedule()
    );
  }

  function vPlay() {
    const g = G.gameById(S.game);
    const tp = G.turnPlayer(S);
    const myTurn = isLocal() || (tp && tp.id === profile.id);
    const card = S.card;
    let main = '';

    if (!card) {
      if (g.id === 'cark') {
        main = vWheel(null) + (myTurn ? '<button class="btn btn-primary btn-xl" data-a="draw">🎡 Çarkı Çevir</button>' : '<div class="waiting">' + nameOf(tp.id) + ' çarkı çeviriyor…</div>');
      } else {
        main =
          '<div class="deck" ' + (myTurn ? 'data-a="draw"' : '') + ' style="--c:' + g.color + '"><div class="deck-card"><span>' + g.icon + '</span><b>Parti Sarayı</b></div><div class="deck-card b2"></div><div class="deck-card b3"></div></div>' +
          (myTurn ? '<button class="btn btn-primary btn-xl" data-a="draw">🃏 Kart Çek</button>' : '<div class="waiting">' + nameOf(tp.id) + ' kart çekiyor…</div>');
      }
    } else {
      const spinning = g.id === 'cark' && card.wheel != null && !card.isPass && ui.spun[card.id] !== true;
      main = (g.id === 'cark' && card.wheel != null && !card.isPass ? vWheel(card) : '') + (spinning ? '<div class="waiting">Çark dönüyor… 🌀</div>' : vCard(g, card, tp, myTurn));
    }

    return (
      vScore(true) +
      '<div class="game-title" style="--c:' + g.color + '"><span>' + g.icon + ' ' + esc(g.name) + '</span><span class="round">Tur ' + Math.min(S.gameRound, S.rounds) + '/' + S.rounds + '</span></div>' +
      '<div class="turn-line">' + (tp ? (isLocal() ? 'Sıra: <b>' + nameOf(tp.id) + '</b>' : tp.id === profile.id ? '👉 <b>Sıra sende!</b>' : 'Sıra: <b>' + nameOf(tp.id) + '</b>') : '') + '</div>' +
      '<section class="play-area">' + main + '</section>' +
      '<div class="row foot-actions">' +
      '<button class="btn btn-mini btn-ghost" data-a="rules">ℹ️ Kurallar</button>' +
      '<button class="btn btn-mini btn-ghost" data-a="endGame">⏹ Lobiye dön</button>' +
      '</div>'
    );
  }

  function vWheel(card) {
    const n = WHEEL.length;
    const seg = 360 / n;
    const grad = WHEEL.map((w, i) => w.color + ' ' + i * seg + 'deg ' + (i + 1) * seg + 'deg').join(',');
    const labels = WHEEL.map((w, i) => '<span class="wl" style="transform:rotate(' + (i * seg + seg / 2) + 'deg) translateY(calc(min(78vw, 300px) * -0.34)) rotate(' + -(i * seg + seg / 2) + 'deg)">' + w.icon + '</span>').join('');
    return (
      '<div class="wheel-wrap' + (card && ui.spun[card.id] === true ? ' mini' : '') + '"><div class="wheel-pointer">▼</div><div id="wheel" class="wheel" data-card="' + (card ? card.id : '') + '" data-w="' + (card ? card.wheel : '') + '" style="background:conic-gradient(' + grad + ')">' +
      labels +
      '</div><div class="wheel-hub">🎡</div></div>'
    );
  }

  function judgeBtns(g, card, tp) {
    const o = S.players.find((p) => p.id !== tp.id);
    const local = isLocal();
    const iAmTurn = tp.id === profile.id;
    const pts = card.points || 1;
    const R = (winner, label, cls, note) =>
      '<button class="btn ' + (cls || 'btn-secondary') + '" data-a="result" data-w="' + (winner || '') + '" data-n="' + esc(note || '') + '">' + label + '</button>';

    if (card.isPass) {
      return '<div class="judge">' + R(null, '✔️ Tamam, sıra geçsin', 'btn-primary', 'Pas kullanıldı') + '</div>';
    }
    switch (g.judge) {
      case 'performer':
        if (!local && iAmTurn) return '<div class="judge-wait">⚖️ Görevi yap! Kararı <b>' + nameOf(o.id) + '</b> verecek.</div>';
        return (
          '<div class="judge"><div class="judge-q">' + (local ? 'Karar ' + nameOf(o.id) + '’de:' : nameOf(tp.id) + ' görevi başardı mı?') + '</div>' +
          '<div class="row">' + R(tp.id, '✅ Başardı +' + pts, 'btn-success', 'Görev başarıldı') + R(null, '❌ Olmadı', 'btn-danger', 'Görev yarım kaldı') + '</div></div>'
        );
      case 'laugh':
        return (
          '<div class="judge"><div class="judge-q">Süre bitmeden ' + nameOf(o.id) + ' güldü mü?</div><div class="row">' +
          R(tp.id, '😂 Güldü! (' + esc(tp.name) + ' +1)', 'btn-success', 'Kahkaha geldi') +
          R(o.id, '😐 Dayandı (' + esc(o.name) + ' +1)', 'btn-secondary', 'Taş gibi dayandı') +
          '</div></div>'
        );
      case 'banned':
        return (
          '<div class="judge"><div class="judge-q">Yasaklı kelimeyi kim söyledi?</div><div class="row">' +
          S.players.map((p) => R(S.players.find((x) => x.id !== p.id).id, '🚫 ' + esc(p.name) + ' söyledi', 'btn-danger', p.name + ' yasaklı kelimeyi söyledi')).join('') +
          '</div>' + R(null, '🤝 Kimse kaçırmadı', 'btn-ghost', 'İkisi de dikkatliydi') + '</div>'
        );
      case 'either':
        return (
          '<div class="judge"><div class="judge-q">Bu turu kim kazandı?</div><div class="row">' +
          S.players.map((p) => R(p.id, '🏆 ' + esc(p.name), 'btn-success', 'Bonus turu kazandı')).join('') +
          '</div>' + R(null, '🤝 Berabere', 'btn-ghost', 'Berabere') + '</div>'
        );
      case 'liar': {
        const btn = (a, i, label, cls) => '<button class="btn ' + cls + '" data-a="' + a + '" data-i="' + i + '">' + label + '</button>';
        if (S.secret === null) {
          if (local || iAmTurn) {
            return (
              '<div class="judge"><div class="judge-q">' + (local ? nameOf(tp.id) + ', ' : '') + '3 hikâyeyi anlat. Uydurma olanı <b>gizlice</b> seç:</div>' +
              (local ? '<div class="muted small">(' + esc(o.name) + ' ekrana bakmasın 🙈)</div>' : '') +
              '<div class="row three">' + [0, 1, 2].map((i) => btn('secret', i, (i + 1) + '. hikâye', 'btn-secondary')).join('') + '</div></div>'
            );
          }
          return '<div class="judge-wait">🎙️ ' + nameOf(tp.id) + ' üç hikâye anlatacak. Dikkatle dinle, sonra yalanı tahmin et!</div>';
        }
        if (!local && iAmTurn) return '<div class="judge-wait">🔒 Seçimin kilitlendi. ' + nameOf(o.id) + ' tahmin ediyor…</div>';
        return (
          '<div class="judge"><div class="judge-q">🔒 Seçim yapıldı. ' + (local ? nameOf(o.id) + ', sence' : 'Sence') + ' hangisi uydurma?</div>' +
          '<div class="row three">' + [0, 1, 2].map((i) => btn('guess', i, (i + 1) + '. hikâye', 'btn-primary')).join('') + '</div></div>'
        );
      }
    }
    return '';
  }

  function vCard(g, card, tp, myTurn) {
    const timerDur = g.timer || 0;
    const words = card.words
      ? '<div class="banned"><div class="banned-title">YASAKLI KELİMELER</div>' + card.words.map((w) => '<span>' + esc(w) + '</span>').join('') + '</div>'
      : '';
    const canPass = !card.isPass && tp && !S.passes[tp.id] && (isLocal() || tp.id === profile.id) && g.judge !== 'either';
    const passLeft = tp && !S.passes[tp.id];
    let timer = '';
    if (!card.isPass && (timerDur || g.id === 'sans' || g.id === 'cark' || g.id === 'bonus')) {
      if (S.timer) {
        timer = '<div class="timer" id="timer" data-id="' + S.timer.id + '" data-dur="' + S.timer.dur + '"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="tr-bg"/><circle cx="22" cy="22" r="19" class="tr-fg" id="timerRing"/></svg><b id="timerNum">' + S.timer.dur + '</b></div>';
      } else {
        const d = timerDur || 30;
        timer = '<button class="btn btn-timer" data-a="timer" data-d="' + d + '">⏱ ' + d + ' sn başlat</button>';
      }
    }
    return (
      '<div class="card pop' + (card.isPass ? ' pass' : '') + '" style="--c:' + g.color + '" data-cid="' + card.id + '">' +
      '<div class="card-top"><span class="cat">' + esc(card.cat) + '</span>' + (card.points > 1 ? '<span class="pts">👑 ' + card.points + ' puan</span>' : '') + '</div>' +
      '<div class="card-text">' + esc(card.text) + '</div>' +
      words +
      (g.id === 'dogru' && !card.isPass ? '<div class="muted small">İkisi gerçek, biri uydurma! 🤥</div>' : '') +
      '</div>' +
      (timer ? '<div class="timer-row">' + timer + (S.timer ? '<button class="btn btn-mini btn-ghost" data-a="timer" data-d="' + S.timer.dur + '">↻</button>' : '') + '</div>' : '') +
      judgeBtns(g, card, tp) +
      '<div class="row card-actions">' +
      (!card.isPass && S.guess === null && S.secret === null ? '<button class="btn btn-mini btn-ghost" data-a="change">🔄 Kartı değiştir</button>' : '') +
      (canPass ? '<button class="btn btn-mini btn-ghost" data-a="pass">🎟️ Pas (' + (passLeft ? '1' : '0') + ' hak)</button>' : '') +
      (!card.isPass && tp && S.passes[tp.id] && (isLocal() || tp.id === profile.id) ? '<span class="muted small">🎟️ Pas hakkı kullanıldı</span>' : '') +
      '</div>'
    );
  }

  function vTiebreak() {
    return (
      vScore() +
      '<div class="tie-title">⚔️ BERABERLİK!</div>' +
      '<div class="card pop" style="--c:#f5d142"><div class="card-top"><span class="cat">Final düellosu</span></div><div class="card-text">' + esc(S.card.text) + '</div></div>' +
      '<div class="judge"><div class="judge-q">Düelloyu kim kazandı?</div><div class="row">' +
      S.players.map((p) => '<button class="btn btn-success" data-a="tiebreak" data-w="' + p.id + '">👑 ' + esc(p.name) + '</button>').join('') +
      '</div></div>'
    );
  }

  function crownTitle(p) {
    if (!p) return 'SARAYIN SAHİBİ';
    const n = p.name.toLocaleLowerCase('tr');
    if (n.includes('ceyda') || p.avatar === '👸') return 'KRALİÇE CEYDA';
    if (n.includes('semih') || p.avatar === '🤴') return 'KRAL SEMİH';
    return 'SARAYIN SAHİBİ';
  }

  function vFinal() {
    const w = P(S.winner);
    const sorted = S.players.slice().sort((a, b) => b.score - a.score);
    const iWon = w && w.id === profile.id && !isLocal();
    return (
      '<section class="final">' +
      '<div class="crown">👑</div>' +
      '<div class="boss-label">' + crownTitle(w) + '</div><div class="boss-tag">Gecenin Party Boss’u</div>' +
      '<div class="boss-av">' + (w ? w.avatar : '🎉') + '</div>' +
      '<div class="boss-name">' + (w ? esc(w.name) : '') + '</div>' +
      '<div class="boss-sub">' + (iWon || isLocal() ? (crownTitle(w) === 'KRALİÇE CEYDA' ? 'Taç yine kraliçede! Sarayın kraliçesi 👸' : crownTitle(w) === 'KRAL SEMİH' ? 'Bu gece taç Semih’te! Sarayın kralı 🤴' : 'Gecenin tacı sende! 🎉') : isLocal() ? 'Tebrikler! 🎉' : 'Bu gece taç onda… rövanş? 😏') + '</div>' +
      '<div class="final-scores">' + sorted.map((p, i) => '<div class="fs"><span>' + (i === 0 ? '🥇' : '🥈') + ' ' + p.avatar + ' ' + esc(p.name) + '</span><b>' + p.score + '</b></div>').join('') + '</div>' +
      '<div class="muted small">' + S.totalRound + ' tur oynandı • ' + (S.gamesPlayed || []).length + ' oyun</div>' +
      '</section>' +
      '<button class="btn btn-primary btn-xl" data-a="rematch">🔁 Rövanş!</button>' +
      '<button class="btn btn-ghost" data-a="history">📜 Tur geçmişi</button>' +
      '<button class="btn btn-ghost" data-a="leave">🏠 ' + (isLocal() ? 'Ana sayfa' : 'Odadan çık') + '</button>'
    );
  }

  function vHistory() {
    const h = (S.history || []).slice().reverse();
    return (
      '<div class="sheet-backdrop" data-a="history"></div><div class="sheet tall"><h3>📜 Tur geçmişi</h3>' +
      (h.length
        ? '<ul class="hist">' +
          h
            .map((e) => {
              const g = G.gameById(e.game);
              return '<li><span class="h-n">#' + e.n + '</span><span class="h-b"><b>' + (g ? g.icon + ' ' + esc(g.name) : '⚔️ Final') + '</b><small>' + esc(e.text) + '</small>' + (e.note ? '<small class="note">' + esc(e.note) + '</small>' : '') + '</span><span class="h-w">' + (e.winner ? nameOf(e.winner) + ' <b>+' + e.pts + '</b>' : '—') + '</span></li>';
            })
            .join('') +
          '</ul>'
        : '<p class="muted">Henüz tur oynanmadı.</p>') +
      '<button class="btn btn-secondary" data-a="history">Kapat</button></div>'
    );
  }

  /* ---------- render sonrası: çark animasyonu, sayaç ---------- */
  let wheelAngle = 0;
  function afterRender() {
    const wheel = document.getElementById('wheel');
    if (wheel) {
      const cid = wheel.getAttribute('data-card');
      const w = wheel.getAttribute('data-w');
      if (ui.spun[cid] === 'spinning') {
        // animasyon sürüyor, dokunma
      } else if (cid && w !== '' && !ui.spun[cid]) {
        const seg = 360 / WHEEL.length;
        const targetMod = (360 - (Number(w) * seg + seg / 2)) % 360;
        const base = wheelAngle - (wheelAngle % 360);
        const next = base + 360 * 5 + targetMod;
        wheel.style.transition = 'none';
        wheel.style.transform = 'rotate(' + wheelAngle + 'deg)';
        void wheel.offsetWidth;
        wheel.style.transition = 'transform 3s cubic-bezier(.17,.67,.21,1)';
        wheel.style.transform = 'rotate(' + next + 'deg)';
        wheelAngle = next;
        ui.spun[cid] = 'spinning';
        setTimeout(() => {
          ui.spun[cid] = true;
          sfx.draw();
          vibrate([30, 30, 30]);
          render();
        }, 3100);
      } else {
        wheel.style.transition = 'none';
        wheel.style.transform = 'rotate(' + wheelAngle + 'deg)';
      }
    }
    tickTimer();
  }

  function tickTimer() {
    const el = document.getElementById('timer');
    if (!el || !S || !S.timer) return;
    const id = S.timer.id;
    if (!ui.timerStarts[id]) {
      // host kendi saatini kullanır; misafir, sayacı ilk gördüğü an başlatır
      const at = S.timer.at;
      ui.timerStarts[id] = (isHost() || isLocal()) && at && Date.now() - at < S.timer.dur * 1000 ? at : Date.now();
    }
    const dur = S.timer.dur;
    const left = Math.max(0, dur - (Date.now() - ui.timerStarts[id]) / 1000);
    const num = document.getElementById('timerNum');
    const ring = document.getElementById('timerRing');
    const sec = Math.ceil(left);
    if (num && num.textContent !== String(sec)) {
      num.textContent = sec;
      if (sec <= 5 && sec > 0) sfx.tick();
    }
    if (ring) {
      const c = 2 * Math.PI * 19;
      ring.style.strokeDasharray = c;
      ring.style.strokeDashoffset = c * (1 - left / dur);
    }
    el.classList.toggle('urgent', left <= 5);
    if (left <= 0 && !ui.timerDone[id]) {
      ui.timerDone[id] = true;
      el.classList.add('done');
      if (num) num.textContent = '⏰';
      sfx.buzz();
      vibrate([200, 100, 200]);
    }
  }
  setInterval(tickTimer, 200);
  setInterval(() => {
    // oda sahibi çevrimdışı banner'ı için periyodik yenileme
    if (S && !isLocal() && !isHost() && presence[S.hostId] === false && ui.screen === 'game') {
      const b = document.querySelector('.banner');
      if (!b || (!b.querySelector('button') && ui.hostAwaySince && Date.now() - ui.hostAwaySince > 20000)) render();
    }
  }, 5000);

  /* ---------- efektler ---------- */
  function showBurst(title, sub) {
    const el = document.createElement('div');
    el.className = 'burst';
    el.innerHTML = '<div class="burst-in"><div class="burst-t">' + title + '</div>' + (sub ? '<div class="burst-s">' + esc(sub) + '</div>' : '') + '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const kill = () => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 350);
    };
    el.addEventListener('click', kill);
    setTimeout(kill, 1900);
  }

  function confetti() {
    const c = document.createElement('canvas');
    c.className = 'confetti';
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#ff3d8b', '#ffb800', '#00d1ff', '#2ee59d', '#9b5cff', '#f5d142'];
    const parts = Array.from({ length: 140 }, () => ({
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * 0.5,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      s: 5 + Math.random() * 7,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      });
      if (t - t0 < 4500) requestAnimationFrame(frame);
      else c.remove();
    })(t0);
  }

  /* ---------- olaylar ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]');
    if (!t || t.disabled) return;
    const a = t.getAttribute('data-a');
    const d = t.dataset;
    switch (a) {
      case 'avatar': {
        saveProfileFromInputs();
        const i = AVATARS.indexOf(profile.avatar);
        profile.avatar = AVATARS[(i + 1) % AVATARS.length];
        store.set('profile', profile);
        t.textContent = profile.avatar;
        sfx.tap();
        break;
      }
      case 'quick':
        profile.name = d.n;
        profile.avatar = d.av;
        store.set('profile', profile);
        sfx.tap();
        render();
        break;
      case 'create':
        createRoom();
        break;
      case 'netTest': {
        const box = document.getElementById('netResult');
        if (!window.mqtt) {
          box.textContent = '❌ Bağlantı kütüphanesi yüklenemedi.';
          break;
        }
        box.innerHTML = '<div class="muted">⏳ Test ediliyor…</div>';
        t.disabled = true;
        KhNet.testAll().then((rs) => {
          const okCount = rs.filter((r) => r.ok).length;
          ui.netResult =
            rs.map((r) => '<div>' + (r.ok ? '✅' : '❌') + ' ' + esc(r.host) + (r.ok ? ' <span class="muted">(' + r.ms + ' ms)</span>' : '') + '</div>').join('') +
            '<div class="net-sum">' + (okCount ? '🎉 Online oda bu cihazda çalışır (' + okCount + '/' + rs.length + ' sunucu).' : '⚠️ Hiçbir sunucuya ulaşılamadı. Wi-Fi/mobil veri değiştir ya da Tek Telefon modunu kullan.') + '</div>';
          const b2 = document.getElementById('netResult');
          if (b2) b2.innerHTML = ui.netResult;
          t.disabled = false;
        });
        break;
      }
      case 'join': {
        const ci = document.getElementById('codeInput');
        const code = (ci && ci.value) || ui.joinCode;
        joinRoom(code, false);
        break;
      }
      case 'localSetup':
        saveProfileFromInputs();
        ui.localSetup = !ui.localSetup;
        render();
        if (ui.localSetup) setTimeout(() => document.getElementById('local2') && document.getElementById('local2').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        break;
      case 'startLocal':
        startLocal();
        break;
      case 'home':
        leaveRoom();
        break;
      case 'menu':
        ui.showMenu = !ui.showMenu;
        render();
        break;
      case 'sound':
        ui.sound = !ui.sound;
        store.set('sound', ui.sound);
        render();
        break;
      case 'history':
        ui.showMenu = false;
        ui.showHistory = !ui.showHistory;
        render();
        break;
      case 'share':
        ui.showMenu = false;
        share();
        render();
        break;
      case 'copyCode':
        copy(inviteLink());
        break;
      case 'leave':
        if (confirm(isLocal() ? 'Oyunu bitirip ana sayfaya dönülsün mü?' : 'Odadan çıkmak istediğine emin misin? Aynı linkle geri dönebilirsin.')) {
          if (isLocal()) store.set('local', null);
          leaveRoom();
        }
        break;
      case 'closeRoom':
        if (confirm('Oda tamamen kapatılsın mı? Arkadaşın da odadan çıkarılır.')) closeRoom();
        break;
      case 'takeover':
        // Oda sahibi çevrimdışı: yönetimi bu cihaz devralır ve durumu yayınlar
        if (S && S.hostId !== profile.id && room) {
          S = G.reduce(S, { type: 'takeover', by: profile.id });
          room.publishState(S);
          toast('👑 Oda yönetimi artık sende.');
          render();
        }
        break;
      case 'ready': {
        const m = me();
        act('ready', { ready: !(m && m.ready) });
        break;
      }
      case 'set':
        act('settings', { [d.k]: Number(d.v) });
        break;
      case 'openGame':
        ui.openGame = ui.openGame === d.g ? null : d.g;
        sfx.tap();
        render();
        break;
      case 'pickGame':
        ui.openGame = null;
        act('pickGame', { game: d.g });
        break;
      case 'draw':
        act('draw');
        break;
      case 'change':
        act('change', { cardId: S.card && S.card.id });
        break;
      case 'pass':
        act('pass', { cardId: S.card && S.card.id });
        break;
      case 'timer':
        act('timer', { cardId: S.card && S.card.id, dur: Number(d.d) });
        break;
      case 'secret':
        act('secret', { cardId: S.card && S.card.id, idx: Number(d.i) });
        break;
      case 'guess':
        act('guess', { cardId: S.card && S.card.id, idx: Number(d.i) });
        break;
      case 'result':
        act('result', { cardId: S.card && S.card.id, winner: d.w || null, note: d.n || '' });
        break;
      case 'tiebreak':
        act('tiebreak', { cardId: S.card && S.card.id, winner: d.w });
        break;
      case 'endGame':
        if (confirm('Bu oyunu bitirip lobiye dönülsün mü? Puanlar korunur.')) act('endGame');
        break;
      case 'finish':
        ui.showMenu = false;
        if (confirm('Gece bitsin mi? Şu anki skora göre taç sahibi açıklanacak.')) act('finish');
        else render();
        break;
      case 'rematch':
        act('rematch');
        break;
      case 'rules': {
        const g = G.gameById(S.game);
        showBurst(g.icon + ' ' + esc(g.name), g.desc);
        break;
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const id = e.target && e.target.id;
    if (id === 'codeInput') joinRoom(e.target.value, false);
    else if (id === 'nameInput') {
      e.target.blur();
      saveProfileFromInputs();
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'codeInput') {
      const v = cleanCode(e.target.value);
      if (v !== e.target.value) e.target.value = v;
      ui.joinCode = v;
    }
    if (e.target && (e.target.id === 'local1' || e.target.id === 'local2')) {
      ui.localNames[e.target.id === 'local1' ? 0 : 1] = e.target.value;
    }
    if (e.target && e.target.id === 'nameInput') {
      profile.name = e.target.value.trim().slice(0, 16);
      store.set('profile', profile);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      room && room.poke();
      if (ui.screen === 'game') keepAwake();
    }
  });
  window.addEventListener('online', () => room && room.poke());
  window.addEventListener('pageshow', (e) => e.persisted && room && room.poke());

  /* ---------- başlangıç ---------- */
  function boot() {
    const params = new URLSearchParams(location.search);
    const urlCode = cleanCode(params.get('oda') || params.get('room') || '');
    const saved = store.get('session', null);
    if (saved && saved.mode === 'local') {
      const ls = store.get('local', null);
      if (ls && ls.mode === 'local' && !urlCode) {
        S = ls;
        session = saved;
        ui.screen = 'game';
        render();
        return;
      }
    }
    if (saved && saved.mode === 'online' && saved.code && (!urlCode || urlCode === saved.code)) {
      session = saved;
      joinRoom(saved.code, true);
      return;
    }
    ui.joinCode = urlCode;
    render();
  }

  boot();
})();
