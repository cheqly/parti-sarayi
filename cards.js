/* Parti Sarayı — görev havuzları.
 * Kural: Rahatsız edici, küçük düşürücü veya özel bilgi isteyen görev yok.
 * Her görev reddedilebilir / değiştirilebilir. */
window.KH_GAMES = [
  {
    id: 'sans',
    icon: '🎲',
    name: 'Şans mı, Rezillik mi?',
    short: 'Rastgele görev çek, sahneyi kap!',
    desc: 'Sırası gelen kart çeker: dans, taklit, reklam, şarkı ya da doğaçlama. Rakip izler ve karar verir: başardı mı?',
    judge: 'performer', // sıradaki oyuncu yapar, rakip karar verir
    timer: 0,
    color: '#ff3d8b'
  },
  {
    id: 'guldur',
    icon: '😂',
    name: 'Beni Güldür',
    short: 'Tek hedef: kahkaha.',
    desc: 'Sırası gelen rakibini güldürmeye çalışır. Güldürürse puan onun, dayanırsa puan rakibin.',
    judge: 'laugh',
    timer: 0,
    color: '#ffb800'
  },
  {
    id: 'dogru',
    icon: '🕵️',
    name: 'Doğru mu, Uydurdum mu?',
    short: '2 gerçek, 1 yalan. Yakala bakalım!',
    desc: 'Anlatıcı karttaki konuda üç kısa hikâye anlatır: ikisi gerçek, biri uydurma. Yalanı gizlice işaretler, rakip tahmin eder.',
    judge: 'liar',
    timer: 0,
    color: '#00d1ff'
  },
  {
    id: 'yasakli',
    icon: '🚫',
    name: 'Yasaklı Kelime',
    short: 'Ağzından kaçırırsan yandın!',
    desc: 'Karttaki konuda sohbet edin. Yasaklı kelimelerden birini söyleyen turu kaybeder, rakibi puanı alır.',
    judge: 'banned',
    timer: 0,
    color: '#ff5a36'
  },
  {
    id: 'cark',
    icon: '🎡',
    name: 'Kader Çarkı',
    short: 'Çarkı çevir, kaderine razı ol.',
    desc: 'Çark 8 kategoriden birinde durur, o kategoriden görev gelir. Kraliyet görevi 2 puan değerindedir!',
    judge: 'performer',
    timer: 0,
    color: '#9b5cff'
  },
  {
    id: 'kralice',
    icon: '👸',
    name: 'Kraliçenin Fermanı',
    short: 'Saraydan ferman var: yerine getir!',
    desc: 'Parti Sarayı’nın kraliçesi ferman yazdı! Sırası gelen fermanı okur ve yerine getirir, rakip karar verir. 👑 işaretli fermanlar 2 puan.',
    judge: 'performer',
    timer: 0,
    color: '#e0245e'
  },
  {
    id: 'bonus',
    icon: '⚡',
    name: 'Bonus Görevler',
    short: 'Kısa, hızlı, kafayı yakmalık ara görevler.',
    desc: 'Şarkı tahmini, emojiyle anlatım, ters röportaj, hayalî restoran, mini film sahnesi… Kartı çeken başlatır, turu kim kazandı siz seçersiniz.',
    judge: 'either',
    timer: 0,
    color: '#2ee59d'
  }
];

window.KH_CARDS = {
  sans: [
    { t: 'Dans', x: 'Hiç müzik yokken en havalı dansını yap. Rakip ritmi tutabilir.' },
    { t: 'Dans', x: 'Robot dansıyla mutfaktan bir şey alıp gelmiş gibi yap.' },
    { t: 'Dans', x: 'Bir düğünde halay başı olduğunu hayal et ve mendil sallayarak oyna.' },
    { t: 'Dans', x: 'Ağır çekimde bir futbolcunun gol sevincini dans olarak yap.' },
    { t: 'Dans', x: 'Sadece kaşların ve omuzlarınla dans et.' },
    { t: 'Taklit', x: 'Hava durumu sunucusu ol ve yarın evde “kahkaha fırtınası” beklendiğini duyur.' },
    { t: 'Taklit', x: 'Bir kediyi, ilk kez salatalık görmüş hâliyle canlandır.' },
    { t: 'Taklit', x: 'Belgesel anlatıcısı ol ve rakibinin şu anki hâlini doğa belgeseli gibi anlat.' },
    { t: 'Taklit', x: 'Navigasyon cihazı ol ve rakibini evin içinde tuvalete kadar yönlendir.' },
    { t: 'Taklit', x: 'Telefonunun şarjı %1 kalmış biri gibi panikle konuş.' },
    { t: 'Taklit', x: 'Maç spikeri ol: rakibinin bir bardak su içişini heyecanla anlat.' },
    { t: 'Reklam', x: 'Yanındaki ilk eşyayı al ve abartılı bir TV reklamı yap.' },
    { t: 'Reklam', x: '“Uyku” adlı yeni bir ürünü gece yarısı tele-alışveriş kanalında sat.' },
    { t: 'Reklam', x: 'Bir çorabı lüks parfüm reklamı gibi, fısıldayarak tanıt.' },
    { t: 'Reklam', x: 'Rakibini “yılın en iyi oyun arkadaşı” ürünü olarak pazarla.' },
    { t: 'Şarkı', x: 'Bugün yediğin yemekleri bir arabesk şarkı gibi söyle.' },
    { t: 'Şarkı', x: 'Bildiğin bir şarkının nakaratını sadece “mıy mıy” diyerek söyle; rakip tahmin etsin.' },
    { t: 'Şarkı', x: 'Bir ninniyi rock yıldızı gibi bağırarak söyle (komşuları düşünerek 😅).' },
    { t: 'Şarkı', x: 'Rakibinin adını kullanarak 4 dizelik bir rap yap.' },
    { t: 'Şarkı', x: 'Alışveriş listesini opera sanatçısı gibi söyle.' },
    { t: 'Doğaçlama', x: 'Bir uzaylıya “çay” nedir, anlat.' },
    { t: 'Doğaçlama', x: 'Yeni icat ettiğin bir sporun kurallarını büyük ciddiyetle açıkla.' },
    { t: 'Doğaçlama', x: 'Kayıp eşyalar bürosunda çalışıyorsun; rakip ne kaybettiğini söyleyecek, sen saçma çözümler üret.' },
    { t: 'Doğaçlama', x: 'Ödül töreninde “En İyi Uyuyan” ödülünü alıyorsun. Teşekkür konuşmanı yap.' },
    { t: 'Doğaçlama', x: '5 yıl sonraki hâlinden şu anki sana sesli mesaj bırak.' },
    { t: 'Doğaçlama', x: 'Bir masal anlat; ama her cümle bir önceki cümlenin son kelimesiyle başlasın.' },
    { t: 'Bursa', x: 'İskender ustası ol: hayalî döneri keserken tereyağını “cızzz” sesiyle dök ve müşteriye sun.' },
    { t: 'Bursa', x: 'Karagöz ol, rakibin Hacivat olsun: birbirinizi yanlış anlayarak atışın. (“Hacivat” süslü konuşur!)' },
    { t: 'Bursa', x: 'Uludağ’da ilk kez kayak yapan birini canlandır: pistten aşağı (salonda) dramatik bir iniş!' },
    { t: 'Bursa', x: 'Kestane şekeri reklamı yap: ama sanki dünyanın en lüks çikolatasıymış gibi.' },
    { t: 'Tekirdağ', x: 'Tekirdağ köftesi ustası ol: köfteleri “sayarak” pişir, her birine bir isim ver.' },
    { t: 'Tekirdağ', x: 'Tekirdağ sahilinde martılara konser veriyormuş gibi şarkı söyle.' },
    { t: 'Tekirdağ', x: 'Kiraz Festivali sunucusu ol ve “yılın en kocaman kirazını” coşkuyla tanıt.' },
    { t: 'Tekirdağ', x: 'Şarköy’de bağ bozumu yapıyormuş gibi üzüm topla ve ayaklarınla ez (dans olarak!).' }
  ],

  guldur: [
    { t: 'İpucu', x: 'Hayalî bir hayvanın sesini çıkar ve onun hikâyesini anlat.' },
    { t: 'İpucu', x: 'En komik suratını yap ve hiç bozmadan bekle.' },
    { t: 'İpucu', x: 'Bir fıkra anlat; ama her cümleyi farklı bir aksanla.' },
    { t: 'İpucu', x: 'Rakibine çok ciddi bir haber veriyormuş gibi yap… haber tamamen saçma olsun.' },
    { t: 'İpucu', x: 'Bir bebeğin ilk kez limon tadışını canlandır.' },
    { t: 'İpucu', x: 'Ağır çekimde hapşırık.' },
    { t: 'İpucu', x: 'Kendi fotoğrafına bakarak bir ünlüymüş gibi röportaj ver.' },
    { t: 'İpucu', x: 'Bir dramatik dizinin final sahnesini tek başına oyna.' },
    { t: 'İpucu', x: 'Sadece ses efektleriyle bir aksiyon filmi anlat.' },
    { t: 'İpucu', x: 'Rakibinin taklidini yap (sevgiyle, kırmadan 💛).' },
    { t: 'Serbest', x: 'Kural yok! Ne istersen yap: yüz, ses, dans, hikâye… Sadece güldür.' },
    { t: 'İpucu', x: 'Bir tavuğun sabah alarmı çaldığında yaşadıklarını canlandır.' },
    { t: 'İpucu', x: 'Okul müdürü ol ve “teneffüste fazla gülme” yasağını duyur.' },
    { t: 'İpucu', x: 'Bir kelimeyi 10 farklı duyguyla söyle: “Patates.”' }
  ],

  dogru: [
    { t: 'Konu', x: 'Çocukluğundan üç anı' },
    { t: 'Konu', x: 'Okulda başına gelen üç olay' },
    { t: 'Konu', x: 'Hayatında yediğin en tuhaf üç yemek' },
    { t: 'Konu', x: 'Bir tatilde başına gelen üç şey' },
    { t: 'Konu', x: 'Üç gizli yeteneğin' },
    { t: 'Konu', x: 'Bir hayvanla yaşadığın üç olay' },
    { t: 'Konu', x: 'Hayatındaki en utandığın değil, en çok güldüğün üç an' },
    { t: 'Konu', x: 'İlk kez denediğin üç şey' },
    { t: 'Konu', x: 'Bir ünlüyle ilgili (gerçek ya da değil) üç hikâye' },
    { t: 'Konu', x: 'Başına gelen üç “şans eseri” olay' },
    { t: 'Konu', x: 'Kaybettiğin ve bulduğun üç eşya' },
    { t: 'Konu', x: 'Sabah rutinine dair üç alışkanlık' },
    { t: 'Konu', x: 'Rüyanda gördüğün üç tuhaf şey' },
    { t: 'Konu', x: 'Hayatında yaptığın üç yemek denemesi' },
    { t: 'Konu', x: 'Bursa ya da Tekirdağ’da başına gelen üç olay' },
    { t: 'Konu', x: 'Semih ile Ceyda’nın tanıdığı biri hakkında üç hikâye' },
    { t: 'Konu', x: 'Bir yolculukta (otobüs, araba, vapur) yaşadığın üç şey' }
  ],

  yasakli: [
    { t: 'Tatil planı', x: 'Hayalinizdeki tatili planlayın.', w: ['deniz', 'otel', 'tatil'] },
    { t: 'Kahvaltı', x: 'Mükemmel bir kahvaltı sofrasını anlatın.', w: ['çay', 'peynir', 'yumurta'] },
    { t: 'Film gecesi', x: 'Birlikte izlenecek filmi seçin.', w: ['film', 'izlemek', 'güzel'] },
    { t: 'Hafta sonu', x: 'Bu hafta sonu ne yapacaksınız?', w: ['evet', 'hayır', 'hafta'] },
    { t: 'Yemek', x: 'Akşam ne pişirelim, tartışın.', w: ['yemek', 'tavuk', 'yani'] },
    { t: 'Okul / iş', x: 'Bugün gün nasıl geçti, anlatın.', w: ['gün', 'şey', 'çok'] },
    { t: 'Hayvanlar', x: 'Sahip olmak istediğiniz evcil hayvanı anlatın.', w: ['kedi', 'köpek', 'sevimli'] },
    { t: 'Müzik', x: 'En sevdiğiniz şarkıları konuşun.', w: ['şarkı', 'müzik', 'sevmek'] },
    { t: 'Süper güç', x: 'Bir süper gücünüz olsa ne olurdu?', w: ['uçmak', 'güç', 'olur'] },
    { t: 'Alışveriş', x: 'Market alışverişi listesi hazırlayın.', w: ['ekmek', 'süt', 'almak'] },
    { t: 'Hava durumu', x: 'Bugünün havası hakkında sohbet edin.', w: ['hava', 'soğuk', 'sıcak'] },
    { t: 'Doğum günü', x: 'Unutulmaz bir doğum günü partisi planlayın.', w: ['pasta', 'parti', 'hediye'] },
    { t: 'Telefon', x: 'Telefonunuzda en çok ne yapıyorsunuz?', w: ['telefon', 'uygulama', 'bakmak'] },
    { t: 'Ev', x: 'Hayalinizdeki evi tarif edin.', w: ['ev', 'oda', 'büyük'] },
    { t: 'Bursa', x: 'Bursa’da bir gün geçirin: nereye gidersiniz, ne yersiniz?', w: ['iskender', 'uludağ', 'bursa'] },
    { t: 'Tekirdağ', x: 'Tekirdağ’da bir hafta sonu planlayın.', w: ['köfte', 'deniz', 'tekirdağ'] },
    { t: 'Saray', x: 'Bir sarayda yaşasanız gününüz nasıl geçerdi?', w: ['kraliçe', 'saray', 'taç'] },
    { t: 'Yol gezisi', x: 'Bursa’dan Tekirdağ’a bir yol gezisi planlayın.', w: ['araba', 'yol', 'mola'] }
  ],

  cark: [
    { t: 'Komedi', x: 'Rakibine en kötü espriyi en büyük özgüvenle yap.' },
    { t: 'Komedi', x: 'Bir stand-up gösterisine “Pazartesi” konulu kısa bir açılış yap.' },
    { t: 'Komedi', x: 'Gülmeden “Şemsiye, şapka, şalgam” demeyi 3 kez dene.' },
    { t: 'Romantik', x: 'Bir buzdolabına aşk mektubu oku.' },
    { t: 'Romantik', x: 'Rakibine abartılı bir şiirle “iyi geceler” dile.' },
    { t: 'Romantik', x: 'Eski bir film sahnesindeki gibi dramatik bir veda yap.' },
    { t: 'Tahmin', x: 'Rakibin aklından 1–10 arası bir sayı tutsun; 3 hakta bul.' },
    { t: 'Tahmin', x: 'Rakibin bir ünlüyü düşünsün; sadece evet/hayır sorularıyla 5 soruda bul.' },
    { t: 'Tahmin', x: 'Rakibin bir şarkıyı mırıldansın; sen 3 hakta bil.' },
    { t: 'Performans', x: 'Bir televizyon yarışmasının sunucusu ol ve rakibini yarışmacı olarak tanıt.' },
    { t: 'Performans', x: 'Bir şarkıyı sadece ıslıkla ya da “la la” ile seslendir.' },
    { t: 'Performans', x: 'En dramatik “haberin var mı?” sahnesini oyna.' },
    { t: 'Taklit', x: 'Rakibinin seçtiği bir ünlüyü taklit et.' },
    { t: 'Taklit', x: 'Bir yapay zekâ asistanı ol ve rakibinin sorularına robotik cevaplar ver.' },
    { t: 'Taklit', x: 'Bir annenin “Ben sana demedim mi?” anını canlandır.' },
    { t: 'Sürpriz', x: 'Rakibin sana bir görev uydursun (makul ve kibar olsun!).' },
    { t: 'Sürpriz', x: 'Bulunduğun odadan rakibin söylediği renkte bir eşyayı bul ve göster.' },
    { t: 'Sürpriz', x: 'Sonraki 3 cümleni kafiyeli kur.' },
    { t: 'Hız Turu', x: '5 meyve say, her biri farklı aksanla.' },
    { t: 'Hız Turu', x: '“K” harfiyle başlayan 6 kelimeyi takılmadan söyle.' },
    { t: 'Hız Turu', x: 'Alfabeyi tersten Z’den başlayarak olabildiğince hızlı say (10 harf yeter).' },
    { t: 'Kraliyet', x: '👑 Bir tur boyunca kral/kraliçe ol: rakibin seni tebaa gibi selamlasın, sen de kraliyet fermanı oku.', p: 2 },
    { t: 'Kraliyet', x: '👑 Kendi ülkenin milli marşını uydur ve göğsünü gere gere söyle.', p: 2 },
    { t: 'Kraliyet', x: '👑 Bir saray şefi ol ve “dünyanın en lüks tostunu” tarif et.', p: 2 },
    { t: 'Kraliyet', x: '👑 Sarayın Kraliçesi/Kralı seçildin! Bursa ile Tekirdağ halkına taç giyme konuşmanı yap.', p: 2 },
    { t: 'Romantik', x: 'Bursa’nın yeşilini ve Tekirdağ’ın denizini birleştiren iki dizelik bir şiir söyle.' }
  ],

  bonus: [
    { t: 'Şarkı tahmini', x: 'Bir şarkıyı sadece “na na na” ile söyle; rakip bulmaya çalışsın. Bulursa rakip, bulamazsa sen kazanırsın.' },
    { t: 'Emojiyle anlatım', x: 'Rakibine mesajla sadece 5 emoji gönder: bir filmi anlat. Bilirse rakip kazanır.' },
    { t: 'Ters röportaj', x: 'Rakibin gazeteci, sen ünlüsün; ama sorudan önce cevabı sen veriyorsun. En komik eşleşmeyi kim yaptı?' },
    { t: 'Hayalî restoran', x: 'İkiniz de hayalî bir restoranın adı + imza yemeğini sunun. En iştah açan kazanır.' },
    { t: 'Mini film sahnesi', x: 'Birlikte kısa bir korku filmi sahnesi oynayın. En inandırıcı çığlığı atan kazanır.' },
    { t: 'Hızlı kelime', x: 'Sırayla “ev” ile biten kelimeler söyleyin. Takılan kaybeder.' },
    { t: 'Ses taklidi', x: 'Sırayla hayvan sesi yapın; aynısını tekrar eden ya da takılan kaybeder.' },
    { t: 'Kafiye düellosu', x: 'Sırayla “gece” ile kafiyeli kelime söyleyin. Takılan kaybeder.' },
    { t: 'Göz düellosu', x: 'Ekrandan göz göze bakışın; ilk gülen kaybeder.' },
    { t: 'Ürün icadı', x: 'İkiniz de saçma bir icat tanıtın. Daha ikna edici olan kazanır.' },
    { t: 'Hikâye zinciri', x: 'Sırayla birer kelime ekleyerek hikâye kurun. Anlamsızlaştıran kaybeder 😄' },
    { t: 'Kategori', x: 'Kategori: Şehirler. Sırayla söyleyin; bulamayan kaybeder.' },
    { t: 'Bursa–Tekirdağ', x: 'Sırayla Bursa ya da Tekirdağ’a ait bir şey söyleyin (yer, yemek, ünlü…). Bulamayan kaybeder.' },
    { t: 'Plaka düellosu', x: 'Sırayla bir şehir ve plaka kodu söyleyin (16 Bursa, 59 Tekirdağ…). Yanlış ya da takılan kaybeder 🚗' },
    { t: 'Koza düellosu', x: 'İkiniz de ipekten bir icat tanıtın (ipek telefon kılıfı?). Daha ikna edici olan kazanır.' }
  ],

  kralice: [
    { t: 'Ferman', x: 'Kraliçe buyurdu: Saray sözcüsü ol ve kraliçenin bugünkü “önemli” kararlarını duyur.' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Kraliçeye 3 farklı ünvan uydur ve her birini reverans yaparak söyle.' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Saray aşçısı ol; kraliçeye Bursa’nın İskender’i ile Tekirdağ köftesini birleştiren yeni bir yemek sun.' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Parti Sarayı’nın resmi marşını 4 dizeyle uydur ve söyle.' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Bir şövalye gibi diz çök ve 3 cümlelik bağlılık yemini et.' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Saray soytarısı ol ve rakibini gülümset.' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Rakibin için en güzel iltifatı, şiir tadında söyle.' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Koza Han’da ipek satan bir tüccar ol ve rakibine hayalî bir ipek eşarp sat.' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Sarayın haber spikeri ol: “Son dakika! Saraydaki İskender ve köfte stokları tükendi!” haberini dramatik ver.' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Kraliçenin hayalî tacını tarif et: hangi taşlar, hangi renkler, Bursa ipeği mi Marmara incisi mi?' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Bir süre sadece kraliyet diliyle konuş (“Efendim, müsaadenizle…”).' },
    { t: 'Ferman', x: 'Kraliçe buyurdu: Bir kraliyet balosunda vals yapıyormuş gibi dans et.' },
    { t: 'Kraliyet', x: '👑 Büyük ferman: Rakibin bir turluğuna kraliçe/kral olur; onun vereceği (kibar!) 3 küçük emri yerine getir.', p: 2 },
    { t: 'Kraliyet', x: '👑 Büyük ferman: Bursa’dan Tekirdağ’a giden bir “kraliyet seferini” tur rehberi gibi anlat.', p: 2 },
    { t: 'Kraliyet', x: '👑 Büyük ferman: Taç giyme töreni sunucusu ol ve rakibini büyük bir coşkuyla tahta davet et.', p: 2 }
  ],

  // Pas hakkı kullanılınca gelen hafif, komik alternatifler
  pas: [
    'Pas cezası: Tavuk gibi gıdakla.',
    'Pas cezası: Rakibine en içten iltifatını et.',
    'Pas cezası: Bir dahaki tura kadar her cümlenin sonuna “efendim” ekle.',
    'Pas cezası: Rakibin “tamam” diyene kadar heykel gibi donup kal.',
    'Pas cezası: Adını tersten söyle ve bir reverans yap.',
    'Pas cezası: “Pas geçtim ama pes etmedim!” diye dramatik bir slogan at.',
    'Pas cezası: En sevdiğin emojiyi yüzünle canlandır.',
    'Pas cezası: Rakibin için kısa bir alkış ritmi tut.'
  ],

  // Beraberlik bozucu final soruları
  final: [
    'Final düellosu: Göz göze bakın, ilk gülen kaybeder!',
    'Final düellosu: Sırayla meyve sayın; bulamayan ya da tekrar eden kaybeder.',
    'Final düellosu: Taş-kağıt-makas, 3 turdan 2’sini alan tacı kapar! 👑',
    'Final düellosu: Sırayla “la” ile biten kelime söyleyin; takılan kaybeder.',
    'Final düellosu: En komik suratı yapan kazanır — kararı ikiniz verin!'
  ]
};

window.KH_WHEEL = [
  { name: 'Komedi', color: '#ff3d8b', icon: '🤡' },
  { name: 'Romantik', color: '#ff6fb5', icon: '💘' },
  { name: 'Tahmin', color: '#00d1ff', icon: '🔮' },
  { name: 'Performans', color: '#ffb800', icon: '🎤' },
  { name: 'Taklit', color: '#9b5cff', icon: '🎭' },
  { name: 'Sürpriz', color: '#2ee59d', icon: '🎁' },
  { name: 'Hız Turu', color: '#ff5a36', icon: '⚡' },
  { name: 'Kraliyet', color: '#f5d142', icon: '👑' }
];

window.KH_SCHEDULE = [
  ['22:00', 'Saraya giriş, isimler, açılış ve kurallar', '10 dk'],
  ['22:10', 'Şans mı, Rezillik mi?', '20 dk'],
  ['22:30', 'Beni Güldür', '20 dk'],
  ['22:50', 'Doğru mu, Uydurdum mu?', '20 dk'],
  ['23:10', 'Kader Çarkı, Kraliçenin Fermanı ve Bonus', '20 dk'],
  ['23:30', 'Yasaklı Kelime final turu', '10 dk'],
  ['23:40', 'Skorlar ve taç töreni 👑', '10 dk'],
  ['23:50+', 'Serbest sohbet, müzik ve kapanış', 'Serbest']
];
