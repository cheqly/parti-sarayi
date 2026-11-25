/* Parti Sarayı — oyun mantığı (saf fonksiyonlar).
 * Online modda yalnızca oda sahibi (host) bu fonksiyonları çalıştırır ve sonucu
 * yayınlar; diğer oyuncu sadece "aksiyon" gönderir. Böylece çakışan tur olmaz. */
(function () {
  const GAMES = window.KH_GAMES;
  const CARDS = window.KH_CARDS;
  const WHEEL = window.KH_WHEEL;
  const ROOM_TTL = 24 * 60 * 60 * 1000;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rnd = (n) => Math.floor(Math.random() * n);
  const gameById = (id) => GAMES.find((g) => g.id === id);

  function newState({ code, mode, host }) {
    return {
      ver: 1,
      code,
      mode, // 'online' | 'local'
      hostId: host ? host.id : null,
      createdAt: Date.now(),
      rev: 0,
      players: host ? [player(host)] : [],
      phase: 'room', // room | lobby | play | tiebreak | final
      target: 5,
      rounds: 6,
      game: null,
      gameRound: 0,
      totalRound: 0,
      turn: 0,
      card: null,
      seq: 0,
      passes: {},
      secret: null,
      guess: null,
      timer: null,
      used: {},
      history: [],
      last: null,
      gamesPlayed: [],
      winner: null
    };
  }

  function player(p) {
    return { id: p.id, name: String(p.name || 'Oyuncu').slice(0, 16), avatar: p.avatar || '😎', score: 0, ready: false };
  }

  const idx = (s, id) => s.players.findIndex((p) => p.id === id);
  const other = (s, id) => s.players.find((p) => p.id !== id);
  const turnPlayer = (s) => s.players[s.turn] || null;
  const queenOf = (s) => s.players.find((p) => /ceyda/i.test(p.name) || String(p.avatar || '').startsWith('👸')) || null;

  function pickFrom(s, pool, key, filter) {
    const list = CARDS[pool];
    let candidates = list.map((c, i) => i).filter((i) => !filter || filter(list[i]));
    const used = (s.used[key] = s.used[key] || []);
    let fresh = candidates.filter((i) => !used.includes(i));
    if (!fresh.length) {
      // havuz bitti: bu anahtarın kullanılmışlarını sıfırla
      s.used[key] = used.filter((i) => !candidates.includes(i));
      fresh = candidates;
    }
    const i = fresh[rnd(fresh.length)];
    s.used[key].push(i);
    return list[i];
  }

  function drawCard(s) {
    const g = s.game;
    s.seq += 1;
    const card = { id: s.seq, game: g, cat: '', text: '', words: null, points: 1, wheel: null, isPass: false };
    if (g === 'cark') {
      const w = rnd(WHEEL.length);
      const c = pickFrom(s, 'cark', 'cark:' + w, (x) => x.t === WHEEL[w].name);
      card.wheel = w;
      card.cat = c.t;
      card.text = c.x;
      card.points = c.p || 1;
    } else if (g === 'defter') {
      const c = pickFrom(s, 'defter', 'defter');
      const opts = c.a.map((t, i) => ({ t, ok: i === 0 }));
      for (let i = opts.length - 1; i > 0; i--) {
        const j = rnd(i + 1);
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      const queen = queenOf(s);
      const tp = turnPlayer(s);
      const answerer = queen ? other(s, queen.id) : tp;
      card.cat = 'Soru';
      card.text = c.q;
      card.opts = opts.map((o) => o.t);
      card.ans = opts.findIndex((o) => o.ok);
      card.answerer = answerer ? answerer.id : null;
      card.queen = queen ? queen.id : null;
    } else {
      const c = pickFrom(s, g, g);
      card.cat = c.t;
      card.text = c.x;
      card.points = c.p || 1;
      if (c.w) card.words = c.w.slice();
    }
    s.card = card;
    s.secret = null;
    s.guess = null;
    s.timer = null;
  }

  function addScore(s, id, pts) {
    const p = s.players[idx(s, id)];
    if (p) p.score = Math.max(0, p.score + pts);
  }

  function settle(s, winnerId, pts, note) {
    const card = s.card;
    if (winnerId) addScore(s, winnerId, pts);
    s.totalRound += 1;
    const entry = {
      n: s.totalRound,
      game: s.game,
      text: card ? (card.isPass ? card.text : (card.cat ? card.cat + ': ' : '') + card.text) : '',
      winner: winnerId || null,
      pts: winnerId ? pts : 0,
      note: note || ''
    };
    s.history.push(entry);
    if (s.history.length > 80) s.history.shift();
    s.last = Object.assign({ seq: s.seq }, entry);
    s.card = null;
    s.timer = null;
    s.secret = null;
    s.guess = null;

    const leader = s.players.find((p) => p.score >= s.target);
    if (leader) {
      s.phase = 'final';
      s.winner = leader.id;
      return;
    }
    s.gameRound += 1;
    if (s.gameRound > s.rounds) {
      s.phase = 'lobby';
      s.game = null;
      s.gameRound = 0;
    } else {
      s.turn = s.turn === 0 ? 1 : 0;
    }
  }

  function bothReady(s) {
    return s.players.length === 2 && s.players.every((p) => p.ready);
  }

  /* reduce(state, action) -> yeni state ya da değişmediyse aynı obje.
   * action = { type, by, ...payload } */
  function reduce(state, a) {
    if (!state || !a || !a.type) return state;
    const s = clone(state);
    const local = s.mode === 'local';
    const by = a.by;
    const me = idx(s, by);
    const isHost = by === s.hostId;
    const tp = turnPlayer(s);
    const cardOk = () => s.card && a.cardId === s.card.id;
    if (a.aid && (state.applied || []).includes(a.aid)) return state;

    switch (a.type) {
      case 'join': {
        if (me >= 0) {
          const p = s.players[me];
          p.name = String(a.name || p.name).slice(0, 16);
          p.avatar = a.avatar || p.avatar;
          break;
        }
        if (s.players.length >= 2) return state;
        s.players.push(player({ id: by, name: a.name, avatar: a.avatar }));
        break;
      }
      case 'ready': {
        if (me < 0 || s.phase !== 'room') return state;
        s.players[me].ready = !!a.ready;
        if (bothReady(s)) s.phase = 'lobby';
        break;
      }
      case 'settings': {
        if (!local && me < 0) return state;
        if ([3, 5, 7, 10, 15].includes(a.target)) s.target = a.target;
        if ([2, 4, 6, 8, 10].includes(a.rounds)) s.rounds = a.rounds;
        if (s.players.some((p) => p.score >= s.target) && s.phase === 'lobby') {
          // hedef düşürüldüyse anında final
          const top = s.players.slice().sort((x, y) => y.score - x.score);
          if (top[0].score !== top[1].score) {
            s.phase = 'final';
            s.winner = top[0].id;
          }
        }
        break;
      }
      case 'pickGame': {
        if (s.phase !== 'lobby' || s.players.length < 2 || !gameById(a.game)) return state;
        s.phase = 'play';
        s.game = a.game;
        s.gameRound = 1;
        s.passes = {};
        s.card = null;
        s.timer = null;
        s.last = null;
        // her oyunu farklı kişi başlatsın
        s.turn = s.gamesPlayed.length % 2;
        s.gamesPlayed.push(a.game);
        break;
      }
      case 'draw': {
        if (s.phase !== 'play' || s.card) return state;
        if (!local && (!tp || tp.id !== by)) return state;
        drawCard(s);
        break;
      }
      case 'change': {
        // Her iki oyuncu da görevi değiştirebilir (ücretsiz, güvenlik hakkı)
        if (s.phase !== 'play' || !cardOk() || s.card.isPass) return state;
        if (me < 0) return state;
        drawCard(s);
        break;
      }
      case 'pass': {
        if (s.phase !== 'play' || !cardOk() || s.card.isPass) return state;
        const pid = tp && tp.id;
        if (!pid || (!local && pid !== by) || s.passes[pid]) return state;
        s.passes[pid] = true;
        s.seq += 1;
        s.card = {
          id: s.seq,
          game: s.game,
          cat: 'Pas',
          text: CARDS.pas[rnd(CARDS.pas.length)],
          words: null,
          points: 0,
          wheel: null,
          isPass: true
        };
        s.timer = null;
        s.secret = null;
        break;
      }
      // Oyunlar süresizdir: sayaç aksiyonları yok sayılır.
      case 'timer':
      case 'stopTimer':
        return state;
      case 'say': {
        // Kart altındaki yazışma: iki oyuncu da yazabilir
        if (s.phase !== 'play' || !cardOk()) return state;
        if (!local && me < 0) return state;
        const text = String(a.text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
        if (!text) return state;
        if (a.aid && (s.card.msgs || []).some((m) => m.id === a.aid)) return state;
        const who = local ? (a.as && idx(s, a.as) >= 0 ? a.as : by) : by;
        s.card.msgs = (s.card.msgs || []).concat([{ by: who, t: text, id: a.aid || String(Date.now()) }]).slice(-40);
        // Yasaklı Kelime: yazılan mesajda yasaklı kelime varsa tur otomatik biter
        if (s.game === 'yasakli' && s.card.words && !s.card.isPass) {
          const low = text.toLocaleLowerCase('tr');
          const hit = s.card.words.find((w) => new RegExp('(^|[^a-zçğıöşüâîû])' + w.toLocaleLowerCase('tr')).test(low));
          if (hit) {
            const writer = s.players[idx(s, who)];
            const winner = other(s, who);
            settle(s, winner ? winner.id : null, 1, (writer ? writer.name : 'Biri') + ' yasaklı kelimeyi yazdı: “' + hit + '”');
          }
        }
        break;
      }
      case 'stories': {
        // Doğru mu Uydurdum mu: anlatıcı 3 hikâyeyi yazar ve uydurmayı gizlice seçer
        if (s.phase !== 'play' || s.game !== 'dogru' || !cardOk() || s.card.isPass) return state;
        if (!local && (!tp || tp.id !== by)) return state;
        if (![0, 1, 2].includes(a.idx) || s.guess !== null || s.secret !== null) return state;
        const st = (Array.isArray(a.texts) ? a.texts : []).slice(0, 3).map((t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 240));
        if (st.length !== 3 || st.some((t) => !t)) return state;
        s.card.stories = st;
        s.secret = a.idx;
        break;
      }
      case 'secret': {
        // Doğru mu Uydurdum mu: anlatıcı yalanı gizlice işaretler
        if (s.phase !== 'play' || s.game !== 'dogru' || !cardOk() || s.card.isPass) return state;
        if (!local && (!tp || tp.id !== by)) return state;
        if (![0, 1, 2].includes(a.idx) || s.guess !== null) return state;
        s.secret = a.idx;
        break;
      }
      case 'guess': {
        if (s.phase !== 'play' || s.game !== 'dogru' || !cardOk() || s.secret === null) return state;
        if (!local && tp && tp.id === by) return state;
        if (![0, 1, 2].includes(a.idx)) return state;
        const teller = tp.id;
        const guesser = other(s, teller).id;
        s.guess = a.idx;
        const right = a.idx === s.secret;
        const lie = s.secret + 1;
        settle(s, right ? guesser : teller, 1, right ? 'Yalan yakalandı! 🕵️ Uydurma ' + lie + '. hikâyeydi' : 'Kandırdı! 😏 Uydurma ' + lie + '. hikâyeydi');
        break;
      }
      case 'result': {
        // winner: oyuncu id'si ya da null (puan yok)
        if (s.phase !== 'play' || !cardOk()) return state;
        if (me < 0 && !local) return state;
        if (a.winner && idx(s, a.winner) < 0) return state;
        const pts = s.card.isPass ? 0 : s.card.points || 1;
        settle(s, s.card.isPass ? null : a.winner, pts, String(a.note || '').slice(0, 80));
        break;
      }
      case 'endGame': {
        if (s.phase !== 'play') return state;
        s.phase = 'lobby';
        s.game = null;
        s.card = null;
        s.timer = null;
        s.gameRound = 0;
        break;
      }
      case 'finish': {
        if (s.phase !== 'lobby' && s.phase !== 'play') return state;
        if (s.players.length < 2) return state;
        s.card = null;
        s.timer = null;
        const [p1, p2] = s.players;
        if (p1.score === p2.score) {
          s.phase = 'tiebreak';
          s.seq += 1;
          s.card = { id: s.seq, game: 'final', cat: 'Beraberlik', text: CARDS.final[rnd(CARDS.final.length)], points: 1, isPass: false };
        } else {
          s.phase = 'final';
          s.winner = p1.score > p2.score ? p1.id : p2.id;
        }
        break;
      }
      case 'answer': {
        // Beyaz Kaplı Defter: kraliçenin rakibi cevaplar
        if (s.phase !== 'play' || s.game !== 'defter' || !cardOk() || !s.card.opts) return state;
        if (!local && by !== s.card.answerer) return state;
        if (![0, 1, 2, 3].includes(a.idx)) return state;
        const right = a.idx === s.card.ans;
        const ansId = s.card.answerer;
        const correct = s.card.opts[s.card.ans];
        const loserPrize = s.card.queen || (other(s, ansId) || {}).id;
        settle(s, right ? ansId : loserPrize, 1, right ? 'Doğru! Kraliçeyi iyi tanıyor ✨' : 'Yanlış! Doğru cevap: ' + correct);
        break;
      }
      case 'tiebreak': {
        if (s.phase !== 'tiebreak' || !cardOk() || idx(s, a.winner) < 0) return state;
        addScore(s, a.winner, 1);
        s.totalRound += 1;
        s.history.push({ n: s.totalRound, game: 'final', text: s.card.text, winner: a.winner, pts: 1, note: 'Beraberlik bozuldu' });
        s.card = null;
        s.phase = 'final';
        s.winner = a.winner;
        break;
      }
      case 'rematch': {
        if (s.phase !== 'final') return state;
        s.players.forEach((p) => (p.score = 0));
        s.phase = 'lobby';
        s.winner = null;
        s.history = [];
        s.last = null;
        s.totalRound = 0;
        s.gamesPlayed = [];
        s.game = null;
        s.card = null;
        break;
      }
      case 'takeover': {
        // Oda sahibi uzun süre çevrimdışıysa diğer oyuncu yönetimi devralır
        if (me < 0 || isHost) return state;
        s.hostId = by;
        break;
      }
      default:
        return state;
    }
    s.rev = (state.rev || 0) + 1;
    // Uygulanan hamlelerin kimliği: aynı hamle iki kez uygulanmasın
    if (a.aid) s.applied = (s.applied || []).concat(a.aid).slice(-80);
    return s;
  }

  function expired(s) {
    return !s || !s.createdAt || Date.now() - s.createdAt > ROOM_TTL;
  }

  window.KhGame = { newState, reduce, gameById, turnPlayer, other, expired, GAMES };
})();
