/* Parti Sarayı — canlı oda senkronizasyonu (MQTT over WebSocket).
 * Kurulum/hesap gerekmez: herkese açık MQTT sunucuları kullanılır.
 * Sağlamlık için oda AYNI ANDA tüm sunuculara bağlanır ve her mesajı hepsine
 * gönderir: bir sunucu çökse ya da bir ağda engelli olsa bile oyun sürer.
 * - <base>/s        : oda durumu (retained → sayfa yenilense de geri yüklenir)
 * - <base>/a        : oyuncu aksiyonları (oda sahibi işler)
 * - <base>/p/<id>   : bağlı/çevrimdışı durumu (last-will ile otomatik)
 */
(function () {
  const BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt'
  ];
  // Test için ?broker=ws://... ile tek sunucuya sabitlenebilir
  try {
    const custom = new URLSearchParams(location.search).get('broker');
    if (custom) BROKERS.splice(0, BROKERS.length, ...custom.split(',').filter(Boolean));
  } catch (e) {}

  const PREFIX = 'parti-sarayi-v1/';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shortHost = (u) => {
    try { return new URL(u).hostname; } catch (e) { return u; }
  };

  class Room {
    constructor({ code, me, onState, onAction, onPresence, onStatus, onConnect }) {
      this.code = code;
      this.me = me;
      this.base = PREFIX + code;
      this.onState = onState;
      this.onAction = onAction;
      this.onPresence = onPresence;
      this.onStatus = onStatus;
      this.onConnect = onConnect;
      this.clients = [];
      this.gotState = false;
      this.presence = {};
      this.closed = false;
    }

    status() {
      const n = this.clients.filter((c) => c.connected).length;
      return n > 0 ? 'online' : 'reconnecting';
    }
    connectedCount() {
      return this.clients.filter((c) => c.connected).length;
    }
    emitStatus() {
      this.onStatus && this.onStatus(this.status(), this.connectedCount(), this.clients.length);
    }

    /* Tüm sunuculara paralel bağlanır; ilki bağlanınca döner. Hiçbiri olmazsa false. */
    open() {
      this.closed = false;
      return new Promise((resolve) => {
        let done = false;
        let failed = 0;
        const finish = (ok) => {
          if (!done) {
            done = true;
            resolve(ok);
          }
        };
        BROKERS.forEach((url) => {
          const client = mqtt.connect(url, {
            clientId: 'kh_' + this.me.slice(0, 10) + '_' + Math.random().toString(36).slice(2, 8),
            clean: true,
            keepalive: 20,
            reconnectPeriod: 2500,
            connectTimeout: 9000,
            resubscribe: true,
            will: { topic: this.base + '/p/' + this.me, payload: '0', retain: true, qos: 1 }
          });
          this.clients.push(client);
          let everConnected = false;
          const giveUp = setTimeout(() => {
            if (!everConnected) {
              failed += 1;
              if (failed === BROKERS.length) finish(false);
            }
          }, 10000);
          client.on('connect', () => {
            everConnected = true;
            clearTimeout(giveUp);
            client.subscribe([this.base + '/s', this.base + '/a', this.base + '/p/+'], { qos: 1 }, () => {
              client.publish(this.base + '/p/' + this.me, '1', { retain: true, qos: 1 });
              this.emitStatus();
              this.onConnect && this.onConnect(client);
              finish(true);
            });
          });
          ['reconnect', 'offline', 'close'].forEach((ev) => client.on(ev, () => this.emitStatus()));
          client.on('error', () => {});
          client.on('message', (topic, buf) => this.handle(topic, buf));
        });
        this.emitStatus();
      });
    }

    handle(topic, buf) {
      if (this.closed) return;
      const text = buf ? buf.toString() : '';
      if (topic === this.base + '/s') {
        if (!text) {
          this.onState && this.onState(null);
          return;
        }
        try {
          const s = JSON.parse(text);
          this.gotState = true;
          this.onState && this.onState(s);
        } catch (e) {}
      } else if (topic === this.base + '/a') {
        try {
          this.onAction && this.onAction(JSON.parse(text));
        } catch (e) {}
      } else if (topic.indexOf(this.base + '/p/') === 0) {
        const id = topic.slice((this.base + '/p/').length);
        const on = text === '1';
        if (this.presence[id] === on) return;
        this.presence[id] = on;
        this.onPresence && this.onPresence(Object.assign({}, this.presence));
      }
    }

    /* Odayı arar: bağlanır ve kayıtlı oda durumunu bekler. */
    async find(waitMs) {
      this.gotState = false;
      const ok = await this.open();
      if (!ok) return false;
      const t0 = Date.now();
      while (!this.gotState && Date.now() - t0 < waitMs) await sleep(100);
      return this.gotState;
    }

    pub(topic, payload, retain, only) {
      (only ? [only] : this.clients).forEach((c) => {
        if (c.connected) c.publish(topic, payload, { retain: !!retain, qos: 1 });
      });
    }
    publishState(s, only) {
      this.pub(this.base + '/s', JSON.stringify(s), true, only);
    }
    clearState() {
      this.pub(this.base + '/s', '', true);
    }
    send(a) {
      this.pub(this.base + '/a', JSON.stringify(a), false);
    }

    leave() {
      this.closed = true;
      const cs = this.clients;
      this.clients = [];
      cs.forEach((c) => {
        try {
          if (c.connected) c.publish(this.base + '/p/' + this.me, '0', { retain: true, qos: 1 });
        } catch (e) {}
        setTimeout(() => {
          try { c.end(true); } catch (e) {}
        }, 300);
      });
    }
  }

  /* Ana sayfadaki "bağlantı testi": her sunucuya ayrı ayrı bağlanmayı dener. */
  function testAll() {
    return Promise.all(
      BROKERS.map(
        (url) =>
          new Promise((resolve) => {
            const t0 = Date.now();
            let c;
            const end = (ok) => {
              try { c && c.end(true); } catch (e) {}
              resolve({ host: shortHost(url), ok, ms: Date.now() - t0 });
            };
            const timer = setTimeout(() => end(false), 8000);
            try {
              c = mqtt.connect(url, { clientId: 'kht_' + Math.random().toString(36).slice(2, 10), reconnectPeriod: 0, connectTimeout: 7500 });
              c.on('connect', () => {
                clearTimeout(timer);
                end(true);
              });
              c.on('error', () => {});
            } catch (e) {
              clearTimeout(timer);
              end(false);
            }
          })
      )
    );
  }

  window.KhNet = { Room, BROKERS, testAll };
})();
