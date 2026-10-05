const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const KEY = 'eric-runner-album-v1';
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script id="dino-album">([\s\S]*?)<\/script>/)?.[1];

function memoryStorage(initial) {
  const values = new Map(initial === undefined ? [] : [[KEY, initial]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

function load(storage) {
  const context = { localStorage: storage };
  if (script) vm.runInNewContext(script, context);
  assert.equal(typeof context.DinoAlbum?.create, 'function', 'o álbum ainda não existe no HTML');
  return context.DinoAlbum;
}

function plain(value) { return JSON.parse(JSON.stringify(value)); }

test('o catálogo oferece doze dinos distintos e protege seus dados', () => {
  const album = load(memoryStorage());
  assert.deepEqual(plain(album.CATALOG).map(dino => dino.id), ['pipo', 'lili', 'tico', 'bubi', 'nino', 'zazu', 'fifi', 'duda', 'ravi', 'lola', 'mimo', 'kiko']);
  assert.deepEqual(plain(album.CATALOG).map(dino => dino.name), ['Pipo', 'Lili', 'Tico', 'Bubi', 'Nino', 'Zazu', 'Fifi', 'Duda', 'Ravi', 'Lola', 'Mimo', 'Kiko']);
  assert.equal(Object.isFrozen(album.CATALOG), true);
  for (const dino of album.CATALOG) {
    assert.equal(Object.isFrozen(dino), true);
    assert.ok(dino.species && dino.color);
  }
});

test('as rachaduras, os dinos e o companheiro escolhido sobrevivem ao recarregar', () => {
  const storage = memoryStorage();
  const model = load(storage).create();
  assert.equal(model.eggProgress, 0);
  assert.deepEqual(plain(model.unlocked), []);
  assert.equal(model.selected, null);
  model.setEggProgress(2);
  assert.equal(load(storage).create().eggProgress, 2);
  assert.deepEqual(plain(model.hatch()), { id: 'pipo', isNew: true, complete: false, count: 1 });
  assert.equal(model.eggProgress, 0);
  model.select('pipo');
  model.setEggProgress(1);
  const reloaded = load(storage).create();
  assert.equal(reloaded.eggProgress, 1);
  assert.deepEqual(plain(reloaded.unlocked), ['pipo']);
  assert.equal(reloaded.selected, 'pipo');
  reloaded.select(null);
  assert.equal(load(storage).create().selected, null);
});

test('sorteios podem completar a coleção e reencontrar qualquer amigo depois', () => {
  let next = 1;
  const model = load(memoryStorage()).create(undefined, () => (next++ % 12) / 12);
  const ids = [];
  for (let i = 0; i < 12; i++) {
    model.setEggProgress(2);
    const result = model.hatch();
    ids.push(result.id);
    assert.equal(result.isNew, true);
    assert.equal(result.complete, i === 11);
    assert.equal(result.count, 1);
    assert.equal(model.eggProgress, 0);
  }
  assert.deepEqual(ids, ['pipo', 'lili', 'tico', 'bubi', 'nino', 'zazu', 'fifi', 'duda', 'ravi', 'lola', 'mimo', 'kiko']);
  assert.deepEqual(plain(model.unlocked), ids);
  assert.deepEqual(plain(model.hatch()), { id: 'pipo', isNew: false, complete: true, count: 2 });
  model.select('tico');
  assert.deepEqual(plain(model.hatch()), { id: 'lili', isNew: false, complete: true, count: 2 });
  assert.equal(model.selected, 'tico', 'o sorteio não troca o companheiro escolhido');
  assert.equal(model.unlocked.length, 12);
});

test('só permite acompanhar um dino descoberto e preserva a seleção após tentativas inválidas', () => {
  const model = load(memoryStorage()).create();
  assert.equal(model.select('pipo'), false);
  model.hatch();
  assert.equal(model.select('pipo'), true);
  assert.equal(model.select('zazu'), false);
  assert.equal(model.select('__proto__'), false);
  assert.equal(model.selected, 'pipo');
  const exposed = model.unlocked;
  exposed.push('zazu');
  assert.equal(model.select('zazu'), false, 'alterar uma cópia não deve desbloquear um dino');
  assert.equal(model.select(null), true);
  assert.equal(model.selected, null);
});

test('ignora valores de progresso fora das três etapas do ovo', () => {
  const model = load(memoryStorage()).create();
  model.setEggProgress(1);
  for (const progress of [-1, 3, 1.5, NaN, Infinity, '2', null, {}, undefined]) {
    assert.equal(model.setEggProgress(progress), false);
    assert.equal(model.eggProgress, 1);
  }
  assert.equal(model.setEggProgress(2), true);
  assert.equal(model.eggProgress, 2);
});

test('recupera somente dinos conhecidos e dados válidos de um álbum antigo', () => {
  const storage = memoryStorage(JSON.stringify({ version: 1, eggProgress: 2,
    unlocked: ['lili', 'pipo', 'pipo', '__proto__', 'fantasma', 4], selected: 'pipo' }));
  const model = load(storage).create(undefined, () => 2 / 12);
  assert.equal(model.eggProgress, 2);
  assert.deepEqual(plain(model.unlocked), ['pipo', 'lili']);
  assert.equal(model.selected, 'pipo');
  assert.equal(model.hatch().id, 'tico');
  const invalidSelection = load(memoryStorage(JSON.stringify({ version: 1, eggProgress: 9,
    unlocked: ['pipo'], selected: 'zazu' }))).create();
  assert.equal(invalidSelection.eggProgress, 0);
  assert.equal(invalidSelection.selected, null);
});

test('JSON quebrado, formatos inesperados e chaves de protótipo reiniciam com segurança', () => {
  for (const value of ['{', 'null', '[]', 'true', '42', '"dino"',
    '{"version":99,"unlocked":["pipo"],"eggProgress":2}',
    '{"version":1,"unlocked":["pipo"],"__proto__":{"selected":"pipo"}}',
    '{"version":1,"unlocked":["pipo"],"constructor":{}}',
    '{"version":1,"unlocked":["pipo"],"prototype":{}}']) {
    const model = load(memoryStorage(value)).create();
    assert.equal(model.eggProgress, 0, value);
    assert.deepEqual(plain(model.unlocked), [], value);
    assert.equal(model.selected, null, value);
  }
});

test('continua em memória quando o navegador bloqueia leitura e escrita', () => {
  const storage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  const model = load(storage).create();
  model.setEggProgress(2);
  assert.equal(model.eggProgress, 2);
  assert.equal(model.hatch().id, 'pipo');
  model.select('pipo');
  assert.equal(model.selected, 'pipo');
  assert.deepEqual(plain(model.unlocked), ['pipo']);
});

test('mantém o álbum atual se somente a gravação passar a falhar', () => {
  const storage = memoryStorage(JSON.stringify({ version: 1, eggProgress: 1, unlocked: ['pipo'], selected: 'pipo' }));
  storage.setItem = () => { throw new Error('sem espaço'); };
  const model = load(storage).create(storage, () => 1 / 12);
  model.setEggProgress(2);
  assert.equal(model.hatch().id, 'lili');
  assert.equal(model.selected, 'pipo');
  assert.deepEqual(plain(model.unlocked), ['pipo', 'lili']);
});

test('acessar o próprio localStorage pode falhar sem impedir a aventura', () => {
  const context = {};
  Object.defineProperty(context, 'localStorage', { get() { throw new Error('bloqueado'); } });
  if (script) vm.runInNewContext(script, context);
  assert.equal(typeof context.DinoAlbum?.create, 'function', 'o álbum ainda não existe no HTML');
  const model = context.DinoAlbum.create();
  model.setEggProgress(2);
  assert.equal(model.hatch().id, 'pipo');
});

test('cada dino explica o poder automático que oferece como companheiro', () => {
  const catalog = plain(load(memoryStorage()).CATALOG);
  assert.deepEqual(catalog.slice(0, 6).map(dino => [dino.id, dino.power]), [
    ['pipo', 'Rugidinho'], ['lili', 'Escudo amigo'], ['tico', 'Busca tesouros'],
    ['bubi', 'Abre caminho'], ['nino', 'Dá coração'], ['zazu', 'Superpasse']
  ]);
  const effects = [/travesso/, /2 segundos/, /moeda.*fóssil/, /obstáculo/, /coração.*moeda/, /bola/];
  const abilities = ['pipo', 'lili', 'tico', 'bubi', 'nino', 'zazu', 'pipo', 'lili', 'tico', 'bubi', 'nino', 'zazu'];
  catalog.forEach((dino, index) => {
    assert.equal(dino.ability, abilities[index]);
    assert.equal(typeof dino.help, 'string');
    assert.match(dino.help, effects[index % 6], dino.id);
    assert.match(dino.help, /^[^.!?]+\.$/, 'a ajuda cabe em uma frase simples');
  });
});

test('um álbum antigo começa sem resgates e mantém suas descobertas', () => {
  const storage = memoryStorage(JSON.stringify({ version: 1, eggProgress: 2,
    unlocked: ['pipo', 'lili'], selected: 'lili' }));
  const model = load(storage).create();
  assert.equal(model.rescues, 0);
  assert.equal(model.eggProgress, 2);
  assert.deepEqual(plain(model.unlocked), ['pipo', 'lili']);
  assert.equal(model.selected, 'lili');
});

test('cada resgate soma um ao total e salva junto com os dados do álbum', () => {
  const storage = memoryStorage(JSON.stringify({ version: 1, eggProgress: 2,
    unlocked: ['pipo', 'lili'], selected: 'lili', rescues: 7 }));
  const model = load(storage).create();
  assert.equal(model.rescues, 7);
  model.recordRescue();
  assert.equal(model.rescues, 8);
  model.recordRescue();
  assert.equal(model.rescues, 9);
  assert.deepEqual(JSON.parse(storage.getItem(KEY)), { version: 1, eggProgress: 2,
    unlocked: ['pipo', 'lili'], selected: 'lili', rescues: 9, counts: {pipo:1,lili:1}, repeatStreak:0 });
  const reloaded = load(storage).create();
  assert.equal(reloaded.rescues, 9);
  reloaded.setEggProgress(1);
  reloaded.select('pipo');
  reloaded.hatch();
  assert.equal(load(storage).create().rescues, 9, 'outras gravações também preservam o total');
});

test('totais de resgates inválidos voltam a zero sem apagar os dinos', () => {
  for (const rescues of [-1, 1000001, 1.5, NaN, Infinity, '2', null, {}, []]) {
    const storage = memoryStorage(JSON.stringify({ version: 1, eggProgress: 1,
      unlocked: ['pipo'], selected: 'pipo', rescues }));
    const model = load(storage).create();
    assert.equal(model.rescues, 0, String(rescues));
    assert.equal(model.eggProgress, 1);
    assert.deepEqual(plain(model.unlocked), ['pipo']);
    assert.equal(model.selected, 'pipo');
    model.recordRescue();
    assert.equal(load(storage).create().rescues, 1);
  }
});

test('resgates continuam em memória com armazenamento bloqueado ou registro corrompido', () => {
  const blocked = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  for (const storage of [blocked, memoryStorage('{'), memoryStorage(
    '{"version":1,"rescues":8,"__proto__":{"selected":"pipo"}}')]) {
    const model = load(storage).create();
    assert.equal(model.rescues, 0);
    model.recordRescue();
    model.recordRescue();
    assert.equal(model.rescues, 2);
    model.hatch();
    assert.equal(model.rescues, 2);
  }
});

test('aceita os limites do total e nunca ultrapassa um milhão de resgates', () => {
  for (const initial of [0, 999999, 1000000]) {
    const storage = memoryStorage(JSON.stringify({ version: 1, rescues: initial }));
    const model = load(storage).create();
    assert.equal(model.rescues, initial);
    model.recordRescue();
    assert.equal(model.rescues, initial === 0 ? 1 : 1000000);
    model.recordRescue();
    assert.equal(load(storage).create().rescues, initial === 0 ? 2 : 1000000);
  }
});

test('o primeiro ovo apresenta Pipo antes de começar os sorteios', () => {
  const model = load(memoryStorage()).create(undefined, () => { throw new Error('o primeiro ovo não sorteia'); });
  assert.deepEqual(plain(model.hatch()), {id:'pipo',isNew:true,complete:false,count:1});
  assert.equal(model.count('pipo'), 1);
  assert.equal(model.count('kiko'), 0);
  assert.equal(model.count('__proto__'), 0);
});

test('ovos posteriores podem trazer qualquer um dos doze amigos ou repetir um encontro', () => {
  const draws = [.999, .5, 0];
  const model = load(memoryStorage()).create(undefined, () => draws.shift());
  model.hatch();
  assert.deepEqual(plain(model.hatch()), {id:'kiko',isNew:true,complete:false,count:1});
  assert.deepEqual(plain(model.hatch()), {id:'fifi',isNew:true,complete:false,count:1});
  assert.deepEqual(plain(model.hatch()), {id:'pipo',isNew:false,complete:false,count:2});
  assert.equal(model.unlocked.length, 3);
  assert.equal(model.count('pipo'), 2);
});

test('depois de dois reencontros consecutivos o próximo ovo descobre um amigo que falta', () => {
  const storage = memoryStorage();
  const model = load(storage).create(undefined, () => 0);
  model.hatch();
  assert.equal(model.hatch().isNew, false);
  assert.equal(model.hatch().isNew, false);
  assert.equal(JSON.parse(storage.getItem(KEY)).repeatStreak, 2);
  assert.equal(model.count('pipo'), 3);
  const reloaded = load(storage).create(undefined, () => .75);
  assert.deepEqual(plain(reloaded.hatch()), {id:'lola',isNew:true,complete:false,count:1});
  assert.equal(JSON.parse(storage.getItem(KEY)).repeatStreak, 0);
  assert.equal(reloaded.count('pipo'), 3);
});

test('uma descoberta zera a espera por novidade e todos os encontros ficam guardados', () => {
  const storage = memoryStorage(JSON.stringify({version:1,eggProgress:2,unlocked:['pipo','lili'],selected:'lili',rescues:8,
    counts:{pipo:4,lili:2},repeatStreak:2}));
  const model = load(storage).create(undefined, () => 0);
  assert.equal(model.hatch().id, 'tico');
  assert.equal(model.hatch().id, 'pipo');
  assert.equal(model.count('pipo'), 5);
  assert.equal(model.count('lili'), 2);
  const saved = JSON.parse(storage.getItem(KEY));
  assert.deepEqual(saved.counts, {pipo:5,lili:2,tico:1});
  assert.equal(saved.repeatStreak, 1);
  const reloaded = load(storage).create();
  assert.equal(reloaded.count('pipo'), 5);
  assert.equal(reloaded.selected, 'lili');
  assert.equal(reloaded.rescues, 8);
  assert.equal(reloaded.eggProgress, 0);
  saved.counts.pipo = 999;
  const exposed = reloaded.unlocked; exposed.push('kiko');
  assert.equal(reloaded.count('pipo'), 5);
  assert.equal(reloaded.count('kiko'), 0);
  assert.equal(reloaded.select('kiko'), false);
});

test('álbuns antigos dão pelo menos um encontro a cada amigo conhecido', () => {
  const model = load(memoryStorage(JSON.stringify({version:1,eggProgress:1,unlocked:['pipo','lili','ravi'],selected:'ravi',rescues:7}))).create();
  assert.equal(model.count('pipo'), 1);
  assert.equal(model.count('lili'), 1);
  assert.equal(model.count('ravi'), 1);
  assert.equal(model.count('fifi'), 0);
  assert.equal(model.selected, 'ravi');
  assert.equal(model.rescues, 7);
  assert.equal(model.eggProgress, 1);
});

test('contagens quebradas e chaves estranhas não inventam amigos nem contaminam os dados', () => {
  const counts = JSON.parse('{"pipo":0,"lili":1.5,"ravi":1000001,"kiko":"5","duda":23,"fantasma":9,"__proto__":{"polluted":true},"constructor":777}');
  const storage = memoryStorage(JSON.stringify({version:1,unlocked:['pipo','lili','ravi','kiko'],selected:'ravi',counts,repeatStreak:3}));
  const model = load(storage).create();
  for (const id of ['pipo','lili','ravi','kiko']) assert.equal(model.count(id), 1, id);
  assert.equal(model.count('duda'), 0);
  assert.equal(model.count('fantasma'), 0);
  assert.equal(model.count('constructor'), 0);
  assert.equal(model.count('__proto__'), 0);
  model.setEggProgress(1);
  const saved = JSON.parse(storage.getItem(KEY));
  assert.deepEqual(saved.counts, {pipo:1,lili:1,ravi:1,kiko:1});
  assert.equal(saved.repeatStreak, 0);
  assert.equal(saved.selected, 'ravi');
  assert.equal(Object.prototype.polluted, undefined);
});

test('formatos de contagem inválidos e sequências de repetição inválidas são ignorados', () => {
  for (const counts of [null, [], 9, 'pipo']) {
    for (const repeatStreak of [-1, 3, 1.5, '2', null]) {
      const storage = memoryStorage(JSON.stringify({version:1,unlocked:['pipo'],counts,repeatStreak}));
      const model = load(storage).create();
      assert.equal(model.count('pipo'), 1);
      model.setEggProgress(1);
      assert.equal(JSON.parse(storage.getItem(KEY)).repeatStreak, 0);
    }
  }
});

test('a contagem de reencontros para no limite e permanece útil sem armazenamento', () => {
  const storage = memoryStorage(JSON.stringify({version:1,unlocked:['pipo'],counts:{pipo:1000000},repeatStreak:0}));
  const model = load(storage).create(undefined, () => 0);
  assert.equal(model.hatch().count, 1000000);
  assert.equal(model.count('pipo'), 1000000);
  assert.equal(load(storage).create().count('pipo'), 1000000);
  const blocked = {getItem(){throw new Error('bloqueado');},setItem(){throw new Error('bloqueado');}};
  const session = load(blocked).create(undefined, () => 0);
  session.hatch(); session.hatch(); session.hatch();
  assert.equal(session.count('pipo'), 3);
  assert.equal(session.hatch().id, 'lili');
});
