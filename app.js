/* Parti Sarayı — arayüz ve akış */
(function () {
  const G = window.KhGame;
  const GAMES = window.KH_GAMES;
  const WHEEL = window.KH_WHEEL;
  const SCHEDULE = window.KH_SCHEDULE;
  const AVATARS = ['👸🏽', '🤴🏽', '👑', '🐦', '🌸', '🌊', '😎', '🦄', '🐸', '🐼', '🦊', '🐙', '👽', '🤖', '🐯', '🍕', '🌶️', '👑'];
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
  if (profile.avatar === '👸') profile.avatar = '👸🏽';
  if (profile.avatar === '🤴') profile.avatar = '🤴🏽';
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
        toast('Oda sahibine ulaşılamadı, tekrar dene.', 'warn');
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
        showError('Oda kapatıldı.');
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
        showBurst((p ? esc(p.name) : '') + ' <b>+' + s.last.pts + '</b>', s.last.note);
        if (w === profile.id || isLocal()) {
          sfx.win();
          vibrate([40, 40, 80]);
        } else {
          sfx.lose();
          vibrate(60);
        }
      } else if (s.phase === 'play' || s.phase === 'lobby') {
        showBurst('Tur geçti', s.last.note || 'Puan yok');
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
      toast('İkiniz de hazırsınız. Parti başlasın!');
    }
    if (prev && prev.players.length < 2 && s.players.length === 2 && s.phase === 'room') {
      const o = s.players.find((p) => p.id !== profile.id);
      if (o && !isLocal()) toast('<b>' + esc(o.name) + '</b> odaya katıldı');
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
      toast('Önce adını seç ya da yaz.', 'warn');
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
      toast('Oda kodu 6 karakter olmalı.', 'warn');
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
      return showError('Bu oda dolu. Parti Sarayı iki kişiliktir.');
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
    const avFor = (n, d) => (/ceyda/i.test(n) ? '👸🏽' : /semih/i.test(n) ? '🤴🏽' : d);
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
    const done = () => toast('Davet linki kopyalandı');
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

  /* ---------- ikon seti (çizgi ikonlar, tek stil) ---------- */
  const ICONS = {
    crown: '<path d="m2 6 4 11h12l4-11-6 5-4-7-4 7-6-5Z"/><path d="M6 21h12"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
    timer: '<path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    back: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sound: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    mute: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    wifi: '<path d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 20 0"/><path d="M12 20h.01"/>',
    play: '<path d="M6 3 20 12 6 21Z"/>',
    dice: '<rect width="18" height="18" x="3" y="3" rx="3"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/>',
    laugh: '<circle cx="12" cy="12" r="10"/><path d="M18 13a6 6 0 0 1-12 0Z"/><path d="M9 9h.01M15 9h.01"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    wheel: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/><path d="M12 2v8M12 14v8M2 12h8M14 12h8M4.9 4.9l5.7 5.7M13.4 13.4l5.7 5.7M19.1 4.9l-5.7 5.7M10.6 13.4l-5.7 5.7"/>',
    scroll: '<path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    cards: '<rect width="12" height="16" x="8" y="4" rx="2"/><path d="M4 8v11a2 2 0 0 0 2 2h9"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
    eyeoff: '<path d="M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5 14 2h3v3l-4.5 4.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    sparkle: '<path d="M12 3 13.9 8.8 20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2Z"/><path d="M19 17v4M17 19h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M9 7h7M9 11h5"/>'
  };
  const ic = (name, cls) =>
    '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  const GAME_ICON = { sans: 'dice', guldur: 'laugh', dogru: 'search', yasakli: 'ban', cark: 'wheel', kralice: 'scroll', defter: 'book', bonus: 'zap' };
  const gIco = (g) => ic(GAME_ICON[g.id] || 'sparkle');
  const av = (p, cls) => '<span class="av' + (cls ? ' ' + cls : '') + '">' + (p ? p.avatar : '') + '</span>';
  const nameOfPlain = (id) => {
    const p = P(id);
    return p ? esc(p.name) : '—';
  };

  const CROWN =
    '<svg class="crown-svg" viewBox="0 0 64 40" aria-hidden="true"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset="1" stop-color="#d9a032"/></linearGradient></defs>' +
    '<path d="M6 34 L2 10 L18 20 L32 4 L46 20 L62 10 L58 34 Z" fill="url(#cg)"/><rect x="6" y="34" width="52" height="5" rx="2" fill="#d9a032"/>' +
    '<circle cx="32" cy="4" r="3" fill="#ff4f8b"/><circle cx="2" cy="10" r="2.5" fill="#ffe9a3"/><circle cx="62" cy="10" r="2.5" fill="#ffe9a3"/></svg>';
  function logo(small) {
    return '<div class="logo' + (small ? ' small' : '') + '">' + CROWN + '<div class="logo-word">Parti <span>Sarayı</span></div></div>';
  }

  const PRESETS = [
    { n: 'Semih', av: '🤴🏽', role: 'Sarayın kralı' },
    { n: 'Ceyda', av: '👸🏽', role: 'Sarayın kraliçesi' }
  ];

  function vHome() {
    const urlCode = cleanCode(ui.joinCode);
    const invited = urlCode.length === 6;
    const preset = PRESETS.find((x) => x.n === profile.name && x.av === profile.avatar);
    return (
      '<main class="screen home">' +
      '<div class="hero">' +
      logo() +
      '<p class="tagline">Semih &amp; Kraliçe Ceyda’nın gecesi</p>' +
      '<p class="subtag">Bursa 16 <i>' + ic('heart', 'ico-xs') + '</i> Tekirdağ 59</p>' +
      '</div>' +
      (invited
        ? '<section class="panel invite"><div class="lbl">Davetlisin</div><div class="code-big">' + esc(urlCode) + '</div><p class="muted small center-text">Adını seç ve odaya gir.</p></section>'
        : '') +
      '<section class="panel">' +
      '<div class="lbl">Sen kimsin?</div>' +
      '<div class="who">' +
      PRESETS.map(
        (x) =>
          '<button class="who-tile' + (preset && preset.n === x.n ? ' on' : '') + '" data-a="quick" data-n="' + x.n + '" data-av="' + x.av + '">' +
          '<span class="av av-lg">' + x.av + '</span><b>' + x.n + '</b><small>' + x.role + '</small>' +
          (preset && preset.n === x.n ? '<span class="tick">' + ic('check') + '</span>' : '') +
          '</button>'
      ).join('') +
      '</div>' +
      '<div class="name-row"><button class="avatar-btn" data-a="avatar" aria-label="Avatar değiştir">' + profile.avatar + '</button>' +
      '<input id="nameInput" class="input" maxlength="16" autocomplete="off" autocapitalize="words" placeholder="ya da başka bir ad yaz" value="' + esc(profile.name) + '"></div>' +
      '</section>' +
      '<section class="panel actions">' +
      (invited
        ? '<button class="btn btn-primary btn-xl" data-a="join">' + ic('login') + 'Odaya katıl</button>' +
          '<button class="btn btn-ghost" data-a="create">' + ic('crown') + 'Yeni oda kur</button>'
        : '<button class="btn btn-primary btn-xl" data-a="create">' + ic('crown') + 'Oda kur</button>' +
          '<div class="divider"><span>ya da koda katıl</span></div>' +
          '<div class="join-row"><input id="codeInput" class="input code-input" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ODA KODU" value="' + esc(urlCode) + '">' +
          '<button class="btn btn-secondary" data-a="join" aria-label="Katıl">' + ic('login') + 'Katıl</button></div>') +
      '<button class="link-btn" data-a="localSetup">' + ic('phone') + 'Tek telefonda oyna</button>' +
      '</section>' +
      (ui.localSetup
        ? '<section class="panel"><div class="lbl">Tek telefon • oyuncular</div>' +
          '<input id="local1" class="input" maxlength="16" placeholder="1. oyuncu" value="' + esc(ui.localNames[0] || 'Semih') + '">' +
          '<input id="local2" class="input" maxlength="16" placeholder="2. oyuncu" value="' + esc(ui.localNames[1] || 'Ceyda') + '">' +
          '<button class="btn btn-primary" data-a="startLocal">' + ic('play') + 'Başla</button></section>'
        : '') +
      '<section class="list">' +
      vDefter() +
      '<details class="list-item"><summary>' + ic('help') + '<span>Nasıl oynanır?</span>' + ic('chevron', 'chev') + '</summary><div class="list-body">' +
      '<ol class="steps"><li><b>Oda kur</b>, linki WhatsApp’tan gönder.</li>' +
      '<li>Diğer oyuncu linke dokunur ya da 6 haneli kodu yazar.</li>' +
      '<li>İkiniz de <b>Hazırım</b> deyince oyunu seçersiniz.</li>' +
      '<li>Sıradaki kart çeker; görev iki ekranda aynı anda görünür.</li>' +
      '<li>Hedef puana ilk ulaşan tacı giyer.</li></ol>' +
      '<p class="muted small">Sesli ya da görüntülü konuşmayı WhatsApp’tan açık tutun. Her görev değiştirilebilir.</p></div></details>' +
      '<details class="list-item"><summary>' + ic('clock') + '<span>Gece programı</span>' + ic('chevron', 'chev') + '</summary><div class="list-body">' + vScheduleTable() + '</div></details>' +
      '<details class="list-item" id="netTest"><summary>' + ic('wifi') + '<span>Bağlantı testi</span>' + ic('chevron', 'chev') + '</summary><div class="list-body">' +
      '<p class="muted small">Online oda için en az bir sunucuya ulaşman yeterli.</p>' +
      '<div id="netResult" class="net-result">' + (ui.netResult || '') + '</div>' +
      '<button class="btn btn-ghost" data-a="netTest">' + ic('wifi') + 'Testi başlat</button></div></details>' +
      '</section>' +
      '<footer class="foot">Parti Sarayı</footer>' +
      '</main>'
    );
  }

  function vDefter() {
    const D = window.KH_DEFTER;
    if (!D) return '';
    return (
      '<details class="list-item defter"><summary>' + ic('book') + '<span>Beyaz Kaplı Defter</span>' + ic('chevron', 'chev') + '</summary><div class="list-body">' +
      '<div class="d-title">Kraliçemiz Ceyda 👸🏽</div>' +
      '<ul class="d-list">' + D.white.map((r) => '<li><span class="d-e">' + r[0] + '</span><span><b>' + esc(r[1]) + '</b><small>' + esc(r[2]) + '</small></span></li>').join('') + '</ul>' +
      '<div class="d-title">Hikâyemiz</div>' +
      '<ol class="d-time">' + D.story.map((r) => '<li><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></li>').join('') + '</ol>' +
      '<div class="d-title dark">Kara Kaplı Defter</div>' +
      '<ul class="d-black">' + D.black.map((x) => '<li>' + ic('x', 'ico-xs') + '<span>' + esc(x) + '</span></li>').join('') + '</ul>' +
      '<p class="d-quote">“' + esc(D.quote) + '”</p>' +
      '</div></details>'
    );
  }

  function vScheduleTable() {
    return '<table class="sched">' + SCHEDULE.map((r) => '<tr><td class="t">' + r[0] + '</td><td>' + esc(r[1]) + '</td><td class="d">' + r[2] + '</td></tr>').join('') + '</table>';
  }
  function vSchedule() {
    return '<section class="list"><details class="list-item"><summary>' + ic('clock') + '<span>Gece programı</span>' + ic('chevron', 'chev') + '</summary><div class="list-body">' + vScheduleTable() + '</div></details></section>';
  }

  function vConnecting() {
    return '<main class="screen center">' + logo() + '<div class="spinner"></div><p class="muted">' + esc(ui.msg || 'Bağlanıyor…') + '</p></main>';
  }

  function vError() {
    return (
      '<main class="screen center">' +
      logo(true) +
      '<div class="panel err"><div class="err-ico">' + ic('info') + '</div><p>' + esc(ui.error) + '</p>' +
      '<button class="btn btn-primary" data-a="home">' + ic('home') + 'Ana sayfa</button></div></main>'
    );
  }

  /* ---------- oyun içi ---------- */
  function vTopbar() {
    const pill = isLocal()
      ? '<span class="pill local">' + ic('phone', 'ico-xs') + 'Tek telefon</span>'
      : '<span id="statusPill" class="pill ' + ui.status + '"><i class="led"></i><span>' + statusText() + '</span></span>';
    return (
      '<header class="topbar">' +
      logo(true) +
      '<div class="top-right">' + pill + '<button class="icon-btn" data-a="menu" aria-label="Menü">' + ic('menu') + '</button></div>' +
      '</header>' +
      (ui.showMenu ? vMenu() : '')
    );
  }

  function statusText() {
    return { online: 'Bağlı', connecting: 'Bağlanıyor', reconnecting: 'Yeniden bağlanıyor', offline: 'Çevrimdışı' }[ui.status] || '';
  }
  function updateStatusPill() {
    const el = document.getElementById('statusPill');
    if (el) {
      el.className = 'pill ' + ui.status;
      const t = el.querySelector('span');
      if (t) t.textContent = statusText();
      el.title = 'Bağlı sunucu: ' + (ui.links || '-');
    }
  }

  function menuRow(a, icon, label, cls) {
    return '<button class="menu-row' + (cls ? ' ' + cls : '') + '" data-a="' + a + '">' + ic(icon) + '<span>' + label + '</span></button>';
  }
  function vMenu() {
    return (
      '<div class="sheet-backdrop" data-a="menu"></div><div class="sheet"><h3>Menü</h3><div class="menu">' +
      menuRow('sound', ui.sound ? 'sound' : 'mute', ui.sound ? 'Ses açık' : 'Ses kapalı') +
      menuRow('history', 'history', 'Tur geçmişi') +
      (!isLocal() && S ? menuRow('share', 'share', 'Davet linkini paylaş') : '') +
      (S && (S.phase === 'lobby' || S.phase === 'play') ? menuRow('finish', 'flag', 'Geceyi bitir, tacı ver') : '') +
      (!isLocal() && isHost() ? menuRow('closeRoom', 'trash', 'Odayı kapat', 'danger') : '') +
      menuRow('leave', 'logout', isLocal() ? 'Oyunu bitir' : 'Odadan çık', 'danger') +
      '</div><button class="btn btn-ghost" data-a="menu">Kapat</button></div>'
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
          const meTag = p.id === profile.id && !isLocal() ? '<em class="tag">Sen</em>' : '';
          return (
            '<div class="sc' + (tp && tp.id === p.id ? ' turn' : '') + '">' +
            '<div class="sc-av">' + av(p) + (isLocal() ? '' : '<i class="dot ' + (on ? 'on' : 'off') + '"></i>') + '</div>' +
            '<div class="sc-body"><div class="sc-name">' + esc(p.name) + meTag + '</div>' +
            '<div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
            '<div class="sc-pts">' + p.score + '</div></div>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="target">' + ic('target', 'ico-xs') + 'Hedef ' + S.target + ' puan</div>'
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
      '<div class="banner">' + ic('wifi', 'ico-sm') + '<span>' + (host ? esc(host.name) : 'Oda sahibi') + ' yeniden bağlanıyor…</span>' +
      (long ? '<button class="btn btn-mini" data-a="takeover">Yönetimi devral</button>' : '') +
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
    const rows = [0, 1]
      .map((i) => {
        const p = S.players[i];
        if (!p)
          return '<div class="player-row empty"><span class="av av-empty">' + ic('user') + '</span><div class="pr-body"><b>Diğer oyuncu bekleniyor</b><small>Davet linkini gönder</small></div><span class="spinner-sm"></span></div>';
        const on = p.id === profile.id || presence[p.id];
        const tags = (p.id === profile.id ? '<em class="tag">Sen</em>' : '') + (p.id === S.hostId ? '<em class="tag gold">Oda sahibi</em>' : '');
        return (
          '<div class="player-row' + (p.ready ? ' ready' : '') + '">' + av(p, 'av-md') +
          '<div class="pr-body"><b>' + esc(p.name) + '</b><div class="pr-meta"><small class="' + (on ? 'ok' : 'warn') + '">' + (on ? 'Bağlı' : 'Yeniden bağlanıyor…') + '</small>' + tags + '</div></div>' +
          '<span class="state ' + (p.ready ? 'ok' : '') + '">' + (p.ready ? ic('check', 'ico-xs') + 'Hazır' : 'Bekliyor') + '</span></div>'
        );
      })
      .join('');
    const waLink = 'https://wa.me/?text=' + encodeURIComponent('Parti Sarayı’na davetlisin! Oda kodu: ' + S.code + '\n' + inviteLink());
    return (
      '<section class="panel room-code">' +
      '<div class="lbl">Oda kodu</div>' +
      '<button class="code-big" data-a="copyCode" aria-label="Linki kopyala">' + esc(S.code) + '</button>' +
      '<div class="row">' +
      '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + waLink + '">' + ic('chat') + 'WhatsApp</a>' +
      '<button class="btn btn-ghost" data-a="share">' + ic('share') + 'Paylaş</button>' +
      '</div><p class="muted small center-text">Koda dokunarak linki kopyalayabilirsin.</p></section>' +
      '<section class="panel players"><div class="lbl">Oyuncular</div>' + rows + '</section>' +
      (mine
        ? '<button class="btn btn-xl ' + (mine.ready ? 'btn-ghost' : 'btn-primary') + '" data-a="ready">' + (mine.ready ? ic('x') + 'Hazır değilim' : ic('check') + 'Hazırım') + '</button>'
        : '<div class="muted center-text">Odaya katılınıyor…</div>') +
      (S.players.length === 2 && !S.players.every((p) => p.ready) ? '<p class="muted center-text small">İkiniz de hazır olunca oyun seçimi açılır.</p>' : '') +
      vSettings()
    );
  }

  function vSettings() {
    const can = isLocal() || isHost();
    const seg = (key, vals, cur) =>
      '<div class="seg">' +
      vals.map((v) => '<button class="seg-btn' + (v === cur ? ' on' : '') + '" ' + (can ? 'data-a="set" data-k="' + key + '" data-v="' + v + '"' : 'disabled') + '>' + v + '</button>').join('') +
      '</div>';
    return (
      '<section class="panel settings"><div class="lbl">Ayarlar</div>' +
      '<div class="set-row"><span>' + ic('target', 'ico-sm') + 'Hedef puan</span>' + seg('target', [3, 5, 10, 15], S.target) + '</div>' +
      '<div class="set-row"><span>' + ic('repeat', 'ico-sm') + 'Oyun başına tur</span>' + seg('rounds', [4, 6, 8, 10], S.rounds) + '</div>' +
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
        '<span class="g-ico">' + gIco(g) + '</span><span class="g-txt"><b>' + esc(g.name) + '</b><small>' + esc(g.short) + '</small></span>' +
        (count ? '<span class="g-badge">' + ic('check', 'ico-xs') + (count > 1 ? count : '') + '</span>' : '') +
        ic('chevron', 'chev') +
        '</button>' +
        (open
          ? '<div class="gcard-body"><p>' + esc(g.desc) + '</p>' +
            '<div class="meta"><span>' + ic('repeat', 'ico-xs') + S.rounds + ' tur</span>' + '<span>' + ic('ticket', 'ico-xs') + '1 pas hakkı</span></div>' +
            '<button class="btn btn-primary" data-a="pickGame" data-g="' + g.id + '">' + ic('play') + 'Başlat</button></div>'
          : '') +
        '</div>'
      );
    }).join('');
    return (
      vScore() +
      (S.last ? '<div class="last">' + ic('history', 'ico-xs') + 'Son tur: ' + (S.last.winner ? nameOfPlain(S.last.winner) + ' +' + S.last.pts : 'puan yok') + '</div>' : '') +
      '<h2 class="h2">Oyununu seç</h2>' +
      '<section class="games">' + cards + '</section>' +
      vSettings() +
      '<button class="btn btn-ghost" data-a="finish">' + ic('flag') + 'Geceyi bitir, tacı ver</button>' +
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
        main = vWheel(null) + (myTurn ? '<button class="btn btn-primary btn-xl" data-a="draw">' + ic('wheel') + 'Çarkı çevir</button>' : '<div class="waiting">' + nameOfPlain(tp.id) + ' çarkı çeviriyor…</div>');
      } else {
        main =
          '<div class="deck" ' + (myTurn ? 'data-a="draw"' : '') + ' style="--c:' + g.color + '"><div class="deck-card">' + CROWN + '<b>Parti Sarayı</b></div><div class="deck-card b2"></div><div class="deck-card b3"></div></div>' +
          (myTurn ? '<button class="btn btn-primary btn-xl" data-a="draw">' + ic('cards') + 'Kart çek</button>' : '<div class="waiting">' + nameOfPlain(tp.id) + ' kart çekiyor…</div>');
      }
    } else {
      const spinning = g.id === 'cark' && card.wheel != null && !card.isPass && ui.spun[card.id] !== true;
      main = (g.id === 'cark' && card.wheel != null && !card.isPass ? vWheel(card) : '') + (spinning ? '<div class="waiting">Çark dönüyor…</div>' : vCard(g, card, tp, myTurn));
    }

    const turnTxt = tp ? (!isLocal() && tp.id === profile.id ? 'Sıra sende' : 'Sıra ' + esc(tp.name) + '’de') : '';
    return (
      vScore(true) +
      '<div class="game-title" style="--c:' + g.color + '"><span class="g-ico sm">' + gIco(g) + '</span><b>' + esc(g.name) + '</b><span class="round">' + Math.min(S.gameRound, S.rounds) + ' / ' + S.rounds + '</span></div>' +
      (tp ? '<div class="turn-line' + (!isLocal() && tp.id === profile.id ? ' mine' : '') + '">' + av(tp, 'av-sm') + '<span>' + turnTxt + '</span></div>' : '') +
      '<section class="play-area">' + main + '</section>' +
      '<div class="row foot-actions">' +
      '<button class="btn btn-mini btn-ghost" data-a="rules">' + ic('info', 'ico-sm') + 'Kurallar</button>' +
      '<button class="btn btn-mini btn-ghost" data-a="endGame">' + ic('back', 'ico-sm') + 'Oyun listesi</button>' +
      '</div>'
    );
  }

  function vWheel(card) {
    const n = WHEEL.length;
    const seg = 360 / n;
    const grad = WHEEL.map((w, i) => w.color + ' ' + i * seg + 'deg ' + (i + 1) * seg + 'deg').join(',');
    const labels = WHEEL.map((w, i) => '<span class="wl" style="transform:rotate(' + (i * seg + seg / 2) + 'deg) translateY(calc(min(76vw, 290px) * -0.34)) rotate(' + -(i * seg + seg / 2) + 'deg)">' + w.icon + '</span>').join('');
    return (
      '<div class="wheel-wrap' + (card && ui.spun[card.id] === true ? ' mini' : '') + '"><div class="wheel-pointer"></div><div id="wheel" class="wheel" data-card="' + (card ? card.id : '') + '" data-w="' + (card ? card.wheel : '') + '" style="background:conic-gradient(' + grad + ')">' +
      labels +
      '</div><div class="wheel-hub">' + CROWN + '</div></div>'
    );
  }

  function judgeBtns(g, card, tp) {
    const o = S.players.find((p) => p.id !== tp.id);
    const local = isLocal();
    const iAmTurn = tp.id === profile.id;
    const pts = card.points || 1;
    const R = (winner, label, cls, note) =>
      '<button class="btn ' + (cls || 'btn-secondary') + '" data-a="result" data-w="' + (winner || '') + '" data-n="' + esc(note || '') + '">' + label + '</button>';
    const wait = (icon, html) => '<div class="judge-wait">' + ic(icon, 'ico-sm') + '<span>' + html + '</span></div>';

    if (card.isPass) {
      return '<div class="judge">' + R(null, ic('check') + 'Tamam, sıra geçsin', 'btn-primary', 'Pas kullanıldı') + '</div>';
    }
    switch (g.judge) {
      case 'performer':
        if (!local && iAmTurn) return wait('info', 'Görevi yap. Kararı <b>' + nameOfPlain(o.id) + '</b> verecek.');
        return (
          '<div class="judge"><div class="judge-q">' + (local ? 'Kararı ' + nameOfPlain(o.id) + ' versin:' : nameOfPlain(tp.id) + ' görevi başardı mı?') + '</div>' +
          '<div class="row">' + R(tp.id, ic('check') + 'Başardı +' + pts, 'btn-success', 'Görev başarıldı') + R(null, ic('x') + 'Olmadı', 'btn-danger', 'Görev yarım kaldı') + '</div></div>'
        );
      case 'laugh':
        return (
          '<div class="judge"><div class="judge-q">' + nameOfPlain(o.id) + ' güldü mü?</div><div class="row">' +
          R(tp.id, 'Güldü · ' + esc(tp.name) + ' +1', 'btn-success', 'Kahkaha geldi') +
          R(o.id, 'Dayandı · ' + esc(o.name) + ' +1', 'btn-secondary', 'Taş gibi dayandı') +
          '</div></div>'
        );
      case 'banned':
        return (
          '<div class="judge"><div class="judge-q">Yasaklı kelimeyi kim söyledi?</div><div class="row">' +
          S.players.map((p) => R(S.players.find((x) => x.id !== p.id).id, ic('ban') + esc(p.name), 'btn-danger', p.name + ' yasaklı kelimeyi söyledi')).join('') +
          '</div>' + R(null, 'Kimse söylemedi', 'btn-ghost', 'İkisi de dikkatliydi') + '</div>'
        );
      case 'either':
        return (
          '<div class="judge"><div class="judge-q">Bu turu kim kazandı?</div><div class="row">' +
          S.players.map((p) => R(p.id, ic('trophy') + esc(p.name), 'btn-success', 'Bonus turu kazandı')).join('') +
          '</div>' + R(null, 'Berabere', 'btn-ghost', 'Berabere') + '</div>'
        );
      case 'quiz': {
        const ansP = P(card.answerer);
        const canAnswer = local || profile.id === card.answerer;
        if (!canAnswer) return wait('book', (ansP ? esc(ansP.name) : 'Rakip') + ' cevaplıyor… Bilemezse puan sana!');
        return (
          '<div class="judge"><div class="judge-q">' + (local && ansP ? esc(ansP.name) + ', doğru' : 'Doğru') + ' cevabı seç:</div>' +
          '<div class="quiz">' + card.opts.map((o, i) => '<button class="btn btn-ghost quiz-opt" data-a="answer" data-i="' + i + '"><span class="qi">' + 'ABCD'[i] + '</span>' + esc(o) + '</button>').join('') + '</div></div>'
        );
      }
      case 'liar': {
        const btn = (a, i, cls) => '<button class="btn ' + cls + '" data-a="' + a + '" data-i="' + i + '">' + (i + 1) + '. hikâye</button>';
        if (S.secret === null) {
          if (local || iAmTurn) {
            return (
              '<div class="judge"><div class="judge-q">' + (local ? esc(tp.name) + ', ' : '') + 'üç hikâyeyi anlat ve uydurma olanı <b>gizlice</b> seç.</div>' +
              (local ? '<div class="muted small center-text">' + ic('eyeoff', 'ico-xs') + ' ' + esc(o.name) + ' ekrana bakmasın</div>' : '') +
              '<div class="row three">' + [0, 1, 2].map((i) => btn('secret', i, 'btn-secondary')).join('') + '</div></div>'
            );
          }
          return wait('mic', nameOfPlain(tp.id) + ' üç hikâye anlatacak. Dinle, sonra uydurmayı tahmin et.');
        }
        if (!local && iAmTurn) return wait('lock', 'Seçimin kilitlendi. ' + nameOfPlain(o.id) + ' tahmin ediyor…');
        return (
          '<div class="judge"><div class="judge-q">' + ic('lock', 'ico-xs') + ' ' + (local ? esc(o.name) + ', sence' : 'Sence') + ' hangisi uydurma?</div>' +
          '<div class="row three">' + [0, 1, 2].map((i) => btn('guess', i, 'btn-primary')).join('') + '</div></div>'
        );
      }
    }
    return '';
  }

  function vCard(g, card, tp, myTurn) {
    const words = card.words
      ? '<div class="banned"><div class="banned-title">Yasaklı kelimeler</div>' + card.words.map((w) => '<span>' + esc(w) + '</span>').join('') + '</div>'
      : '';
    const canPass = !card.isPass && tp && !S.passes[tp.id] && (isLocal() || tp.id === profile.id) && g.judge !== 'either' && g.judge !== 'quiz';
    return (
      '<div class="card pop' + (card.isPass ? ' pass' : '') + '" style="--c:' + g.color + '" data-cid="' + card.id + '">' +
      '<div class="card-top"><span class="cat">' + esc(card.cat) + '</span>' + (card.points > 1 ? '<span class="pts">' + ic('crown', 'ico-xs') + card.points + ' puan</span>' : '') + '</div>' +
      '<div class="card-text">' + esc(card.text) + '</div>' +
      words +
      (g.id === 'dogru' && !card.isPass ? '<div class="card-note">İkisi gerçek, biri uydurma.</div>' : '') +
      '</div>' +
            judgeBtns(g, card, tp) +
      '<div class="row card-actions">' +
      (!card.isPass && S.guess === null && S.secret === null ? '<button class="btn btn-mini btn-ghost" data-a="change">' + ic('refresh', 'ico-sm') + 'Kartı değiştir</button>' : '') +
      (canPass ? '<button class="btn btn-mini btn-ghost" data-a="pass">' + ic('ticket', 'ico-sm') + 'Pas geç (1 hak)</button>' : '') +
      (!card.isPass && tp && S.passes[tp.id] && (isLocal() || tp.id === profile.id) ? '<span class="muted small">Pas hakkı kullanıldı</span>' : '') +
      '</div>'
    );
  }

  function vTiebreak() {
    return (
      vScore() +
      '<div class="tie-title">' + ic('swords') + 'Beraberlik</div>' +
      '<div class="card pop" style="--c:#d9a032"><div class="card-top"><span class="cat">Final düellosu</span></div><div class="card-text">' + esc(S.card.text) + '</div></div>' +
      '<div class="judge"><div class="judge-q">Düelloyu kim kazandı?</div><div class="row">' +
      S.players.map((p) => '<button class="btn btn-primary" data-a="tiebreak" data-w="' + p.id + '">' + ic('crown') + esc(p.name) + '</button>').join('') +
      '</div></div>'
    );
  }

  function crownTitle(p) {
    if (!p) return 'Sarayın Sahibi';
    const n = p.name.toLocaleLowerCase('tr');
    if (n.includes('ceyda') || p.avatar.startsWith('👸')) return 'Kraliçe Ceyda';
    if (n.includes('semih') || p.avatar.startsWith('🤴')) return 'Kral Semih';
    return 'Sarayın Sahibi';
  }

  function vFinal() {
    const w = P(S.winner);
    const sorted = S.players.slice().sort((a, b) => b.score - a.score);
    const iWon = w && w.id === profile.id;
    const title = crownTitle(w);
    const sub = isLocal() || iWon
      ? title === 'Kraliçe Ceyda' ? 'Taç yine kraliçede 🌸 İyi, güzel, narin ve nazik.' : title === 'Kral Semih' ? 'Bu gece taç Semih’te.' : 'Gecenin tacı sende.'
      : 'Bu gece taç onda. Rövanş?';
    return (
      '<section class="final">' +
      '<div class="final-crown">' + CROWN + '</div>' +
      '<div class="boss-tag">Gecenin kazananı</div>' +
      '<div class="boss-label">' + esc(title) + '</div>' +
      '<div class="boss-av">' + av(w, 'av-xl') + '</div>' +
      '<div class="boss-sub">' + sub + '</div>' +
      '<div class="final-scores">' + sorted.map((p, i) => '<div class="fs"><span class="rank">' + (i + 1) + '</span>' + av(p, 'av-sm') + '<span class="fs-name">' + esc(p.name) + '</span><b>' + p.score + '</b></div>').join('') + '</div>' +
      '<div class="muted small">' + S.totalRound + ' tur • ' + (S.gamesPlayed || []).length + ' oyun</div>' +
      '</section>' +
      '<button class="btn btn-primary btn-xl" data-a="rematch">' + ic('repeat') + 'Rövanş</button>' +
      '<div class="row"><button class="btn btn-ghost" data-a="history">' + ic('history') + 'Geçmiş</button>' +
      '<button class="btn btn-ghost" data-a="leave">' + ic(isLocal() ? 'home' : 'logout') + (isLocal() ? 'Ana sayfa' : 'Çık') + '</button></div>'
    );
  }

  function vHistory() {
    const h = (S.history || []).slice().reverse();
    return (
      '<div class="sheet-backdrop" data-a="history"></div><div class="sheet tall"><h3>Tur geçmişi</h3>' +
      (h.length
        ? '<ul class="hist">' +
          h
            .map((e) => {
              const g = G.gameById(e.game);
              return '<li><span class="h-ico">' + (g ? gIco(g) : ic('swords')) + '</span><span class="h-b"><b>' + (g ? esc(g.name) : 'Final düellosu') + '</b><small>' + esc(e.text) + '</small></span><span class="h-w">' + (e.winner ? nameOfPlain(e.winner) + ' <b>+' + e.pts + '</b>' : '—') + '</span></li>';
            })
            .join('') +
          '</ul>'
        : '<p class="muted">Henüz tur oynanmadı.</p>') +
      '<button class="btn btn-ghost" data-a="history">Kapat</button></div>'
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
          box.textContent = 'Bağlantı kütüphanesi yüklenemedi.';
          break;
        }
        box.innerHTML = '<div class="muted">Test ediliyor…</div>';
        t.disabled = true;
        KhNet.testAll().then((rs) => {
          const okCount = rs.filter((r) => r.ok).length;
          ui.netResult =
            rs.map((r) => '<div class="net-row ' + (r.ok ? 'ok' : 'bad') + '">' + ic(r.ok ? 'check' : 'x', 'ico-sm') + '<span>' + esc(r.host) + '</span>' + (r.ok ? '<span class="muted">' + r.ms + ' ms</span>' : '') + '</div>').join('') +
            '<div class="net-sum">' + (okCount ? 'Online oda bu cihazda çalışır (' + okCount + '/' + rs.length + ' sunucu).' : 'Hiçbir sunucuya ulaşılamadı. Wi-Fi ya da mobil veriyi değiştir veya tek telefonda oyna.') + '</div>';
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
          toast('Oda yönetimi artık sende.');
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
      case 'answer':
        act('answer', { cardId: S.card && S.card.id, idx: Number(d.i) });
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
        showBurst(esc(g.name), g.desc);
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
