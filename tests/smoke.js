// Прогон всех страниц пула в jsdom: ошибки скриптов, ключевые узлы, сценарии модели.
const {JSDOM} = require('jsdom');
const fs = require('fs');
const path = require('path');
const {indexedDB, IDBKeyRange} = require('fake-indexeddb');

const SITE = path.join(__dirname, '..', 'site');
let failed = 0;
const ok  = (m) => console.log('  ✓ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); failed++; };

function fakeCtx(){
  return new Proxy({canvas:{width:900,height:600}, measureText:()=>({width:10}),
    createRadialGradient:()=>({addColorStop(){}}), createLinearGradient:()=>({addColorStop(){}}),
    getImageData:()=>({data:[]})}, {get:(t,k)=> k in t ? t[k] : ()=>{}, set:()=>true});
}

function load(file){
  const errs = [];
  const dom = new JSDOM(fs.readFileSync(path.join(SITE, file), 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local/',
    beforeParse(w){
      w.print = () => {};
      w.onerror = (m) => errs.push(String(m));
      w.indexedDB = indexedDB; w.IDBKeyRange = IDBKeyRange;
      w.HTMLCanvasElement.prototype.getContext = () => fakeCtx();
      w.Element.prototype.scrollIntoView = function(){};
      if (w.HTMLMediaElement) {
        w.HTMLMediaElement.prototype.load = function(){};
        w.HTMLMediaElement.prototype.play = () => Promise.resolve();
        w.HTMLMediaElement.prototype.pause = function(){};
      }
      w.AudioContext = function(){
        this.state='running'; this.currentTime=0; this.destination={};
        this.createOscillator=()=>({connect(){},start(){},stop(){},frequency:{value:0,setValueAtTime(){}},type:''});
        this.createGain=()=>({connect(){},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}}});
        this.createBiquadFilter=()=>({connect(){},frequency:{value:0,setValueAtTime(){}},Q:{value:1},type:''});
        this.resume=()=>{}; this.suspend=()=>{}; this.close=()=>{};
      };
      w.webkitAudioContext = w.AudioContext;
    }
  });
  return {dom, d: dom.window.document, W: dom.window, errs};
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const click = (W, el) => el && el.dispatchEvent(new W.MouseEvent('click', {bubbles:true}));

(async () => {
  // 1. Синтаксис скриптов во всех файлах
  console.log('\nСинтаксис скриптов');
  for (const f of fs.readdirSync(SITE).filter(x => x.endsWith('.html'))) {
    const src = fs.readFileSync(path.join(SITE, f), 'utf8');
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let m, badScript = false;
    while ((m = re.exec(src))) { try { new Function(m[1]); } catch(e){ badScript = e.message; } }
    badScript ? bad(f + ' — ' + badScript) : ok(f);
  }

  // 2. Страницы базы знаний открываются без ошибок
  console.log('\nСтраницы базы знаний');
  for (const f of ['index.html','00-ukazatel-bz-ii-medicina.html','01-zarubezhnyy-segment.html',
                   '02-paralleli-i-modeli.html','03-koncentraciya-i-ii-medicina.html',
                   '04-processnaya-model.html','05-trek-osvoeniya.html','06-uroven-uchastiya.html']) {
    const {d, errs} = load(f);
    await wait(500);
    errs.length ? bad(f + ' — ошибки: ' + errs.slice(0,2).join('; ')) : ok(f + ' — без ошибок');
    if (f !== 'index.html') {
      const panes = d.querySelectorAll('section.pane').length;
      panes > 0 ? ok(`  разделов: ${panes}`) : bad('  разделы не найдены');
    }
  }

  // 3. Битые внутренние ссылки
  console.log('\nВнутренние ссылки');
  const files = new Set(fs.readdirSync(SITE));
  let broken = 0;
  for (const f of fs.readdirSync(SITE).filter(x => x.endsWith('.html'))) {
    const src = fs.readFileSync(path.join(SITE, f), 'utf8');
    for (const href of new Set([...src.matchAll(/href="([^"#:${]+\.html)(?:#[^"]*)?"/g)].map(m => m[1]))) {
      if (!files.has(href) && !href.startsWith('../')) { bad(`${f} → ${href}`); broken++; }
    }
  }
  if (!broken) ok('битых ссылок нет');

  // 4. Модель: меню, настройки, сценарий сессии, запись
  console.log('\nМодель «Концентрация и дыхание»');
  const {d, W, errs} = load('concentration-breathing-model.html');
  await wait(700);
  errs.length ? bad('ошибки скриптов: ' + errs.slice(0,2).join('; ')) : ok('загрузка без ошибок');

  const menu = [...d.querySelectorAll('#topbar button')].length;
  menu >= 7 ? ok(`верхнее меню: ${menu} кнопок`) : bad('верхнее меню неполное');
  d.querySelector('#adv-body .cols') ? ok('ползунки в расширенных настройках') : bad('ползунки не перенесены');
  d.querySelectorAll('.hint-mark').length >= 10 ? ok('маркеры подсказок на месте') : bad('маркеров подсказок мало');

  click(W, d.getElementById('tb-quick'));
  const reasons = d.querySelectorAll('#rs-reasons .rs-reason').length;
  reasons === 12 ? ok('экран причин: 12 причин') : bad(`причин ${reasons}, ожидалось 12`);

  click(W, d.querySelector('[data-reason="Боль"]'));
  const pars = [...d.querySelectorAll('#rs-card [data-par]')].length;
  pars >= 8 ? ok(`карточка параметров: ${pars} полей`) : bad('карточка параметров неполная');
  d.querySelector('[data-q="pre:quality"]') ? ok('вопрос о характере боли') : bad('нет вопроса о характере боли');

  const h2 = d.querySelector('#rs-card [data-par="t-h2"]');
  h2.value = '20'; h2.dispatchEvent(new W.Event('input', {bubbles:true}));
  d.getElementById('t-h2').value === '20' ? ok('правка в карточке уходит в ползунок') : bad('правка не доходит до ползунка');

  click(W, d.querySelector('[data-q="pre:area"][data-v="heart"]'));
  click(W, d.querySelector('[data-q="pre:level"][data-v="7"]'));
  click(W, d.getElementById('rs-go'));
  await wait(250);
  d.getElementById('session-live').classList.contains('on') ? ok('сессия запускается') : bad('сессия не запустилась');

  // Процесс шёл параллельно: точка до сессии отбрасывается, внутри секунды остаётся последняя
  const fbOrig = W.__cbFbTrack, fbStart = W.performance.now() - 2000;
  // сессия идёт уже ~250 мс: точки 1.9 и 1.95 внутри её первой секунды, 1.0 — до старта
  W.__cbFbTrack = () => ({start: fbStart, track: [{t:1.0, v:99}, {t:1.9, v:10}, {t:1.95, v:20}]});
  W.__cbSessEvent('contact');
  click(W, d.getElementById('sess-exit'));
  await wait(250);
  d.getElementById('post-screen').classList.contains('on') ? ok('экран вопросов после сессии') : bad('нет экрана после сессии');
  click(W, d.querySelector('[data-q="post:level"][data-v="3"]'));
  click(W, d.getElementById('ps-save'));
  await wait(350);
  const idx = await W.CB_DB.all('index');
  const ses = await W.CB_DB.all('sessions');
  idx.length && ses.length ? ok('запись сохранена в указатель и сессии') : bad('запись не сохранилась');
  if (ses.length) {
    const r = ses[ses.length-1];
    r.fmt === 'cb-record-2' ? ok('формат записи cb-record-2') : bad('неверная версия формата');
    r.reason === 'Боль' && r.reasonCode === 'R02' && r.reasonGroup === 'pain'
      ? ok('в записи причина, код и группа') : bad('в записи нет кода или группы причины');
    idx[idx.length-1].reasonCode === 'R02' ? ok('код причины в указателе') : bad('в указателе нет кода причины');
    r.stated.pre.level === 7 && r.stated.post.level === 3 ? ok('ответы до и после записаны') : bad('ответы записаны неверно');
    r.stated.pre.area === 'heart' && r.stated.pre.ctx === '__skipped' && r.stated.pre.quality === '__skipped'
      ? ok('показанный вопрос без ответа — __skipped') : bad('неотвеченный вопрос до сессии не помечен пропуском');
    r.set.params && r.set.params['t-h2'] === 20 ? ok('фактические параметры записаны') : bad('параметры сессии не записаны');

    // З-2: сырьё в series, тот же id, одной транзакцией с sessions и index
    const sr = (await W.CB_DB.all('series')).find(x => x.id === r.id);
    sr && idx.some(x => x.id === r.id) ? ok('series: запись с тем же id, что в sessions и index') : bad('в series нет записи сессии');
    if (sr) {
      const ev = sr.events.map(x => x.e).join(',');
      ev === 'start,contact,end' ? ok('series.events: start, contact, end') : bad('series.events: ' + ev);
      sr.events.every((x, i, a) => typeof x.t === 'number' && (!i || x.t >= a[i-1].t))
        ? ok('время событий растёт от старта') : bad('время событий неверно');
      JSON.stringify(sr.react) === '[20]' ? ok('react: окно сессии, одно значение в секунду') : bad('react: ' + JSON.stringify(sr.react));
      !('rr' in sr) && !('spo2' in sr) ? ok('без датчика rr и spo2 не пишутся') : bad('rr/spo2 записаны без датчика');
    }
  }
  W.__cbFbTrack = fbOrig;

  // Коды причин неизменяемы (Р-8): соответствие коду и строке
  const CODES = {'Дискомфорт':'R01','Боль':'R02','Острая боль':'R03','Хроническая боль':'R04','Воспаление':'R05',
    'Расслабление':'R06','Восстановление':'R07','Усталость':'R08','Концентрация':'R09','Тревога':'R10',
    'Интуиция':'R11','Профилактика':'R12'};
  JSON.stringify(W.CB_REASON_CODES) === JSON.stringify(CODES)
    ? ok('коды причин R01–R12 соответствуют строкам') : bad('коды причин не совпадают с таблицей');

  // Старые записи cb-record-1: код подставляется при чтении, исходник не меняется
  await W.CB_DB.put('sessions', {id:'OLD1', fmt:'cb-record-1', reason:'Тревога'});
  await W.CB_DB.put('sessions', {id:'OLD2', fmt:'cb-record-1', reason:'Бессонница'});
  const old = Object.fromEntries((await W.CB_DB.all('sessions')).map(x => [x.id, x]));
  old.OLD1.reasonCode === 'R10' && old.OLD1.reasonGroup === 'calm' && !old.OLD1.reasonUnknown
    ? ok('старая запись получает код по строке') : bad('старая запись не получила код');
  old.OLD2.reasonCode === 'R00' && old.OLD2.reasonUnknown === true && old.OLD2.reason === 'Бессонница'
    ? ok('неизвестная причина — R00 с пометкой') : bad('неизвестная причина обработана неверно');
  old.OLD1.fmt === 'cb-record-1' ? ok('версия старой записи не переписывается') : bad('версия старой записи изменена');

  // Escape: в сессии — на экран после, на экране после — как «Пропустить»
  const esc = () => d.dispatchEvent(new W.KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
  click(W, d.getElementById('tb-quick'));
  click(W, d.querySelector('[data-reason="Тревога"]'));
  click(W, d.getElementById('rs-go'));
  await wait(250);
  d.getElementById('session-live').classList.contains('on') ? ok('вторая сессия запускается') : bad('вторая сессия не запустилась');
  esc(); await wait(250);
  d.getElementById('post-screen').classList.contains('on') ? ok('Escape в сессии открывает экран после') : bad('Escape не открыл экран после');
  esc(); await wait(350);
  const esr = (await W.CB_DB.all('sessions')).find(x => x.reason === 'Тревога' && x.fmt === 'cb-record-2');
  const esi = (await W.CB_DB.all('index')).find(x => esr && x.id === esr.id);
  esr && esr.stated.postSkipped === true ? ok('Escape на экране после записывает сессию как пропуск') : bad('сессия после Escape не записана');
  esr && esr.stated.pre.ctx === '__skipped' && esr.stated.pre.level === '__skipped' && esi && esi.pre === null
    ? ok('пропуски до сессии: в записи __skipped, в указателе null') : bad('пропуски до сессии записаны неверно');
  !d.getElementById('post-screen').classList.contains('on') ? ok('экран после закрыт') : bad('экран после не закрылся');
  const ess = esr && (await W.CB_DB.all('series')).find(x => x.id === esr.id);
  ess && Array.isArray(ess.react) && ess.react.length === 0 && ess.events.map(x => x.e).join(',') === 'start,end'
    ? ok('series после Escape: пустой react, события start и end') : bad('series после Escape записан неверно');

  // Возврат из настроек
  click(W, d.getElementById('tb-set'));
  click(W, d.querySelector('#tb-drop [data-set="adv"]'));
  d.getElementById('adv-settings').classList.contains('on') ? ok('расширенные настройки открываются') : bad('расширенные не открылись');
  click(W, d.getElementById('adv-save'));
  !d.getElementById('adv-settings').classList.contains('on') ? ok('«Сохранить и выйти» закрывает экран') : bad('экран не закрылся');
  W.localStorage.getItem('cb_settings_v1') ? ok('настройки сохраняются') : bad('настройки не сохранились');

  console.log(failed ? `\nПРОВАЛЕНО проверок: ${failed}\n` : '\nВсе проверки пройдены\n');
  process.exit(failed ? 1 : 0);
})();
