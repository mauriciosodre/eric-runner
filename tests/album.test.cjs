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

test('o catálogo oferece seis dinos distintos e protege seus dados', () => {
  const album = load(memoryStorage());
  assert.deepEqual(plain(album.CATALOG).map(dino => dino.id), ['pipo', 'lili', 'tico', 'bubi', 'nino', 'zazu']);
  assert.deepEqual(plain(album.CATALOG).map(dino => dino.name), ['Pipo', 'Lili', 'Tico', 'Bubi', 'Nino', 'Zazu']);
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
  assert.deepEqual(plain(model.hatch()), { id: 'pipo', isNew: true, complete: false });
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

test('cada ovo descobre um novo dino até completar a coleção sem duplicar', () => {
  const model = load(memoryStorage()).create();
  const ids = [];
  for (let i = 0; i < 6; i++) {
    model.setEggProgress(2);
    const result = model.hatch();
    ids.push(result.id);
    assert.equal(result.isNew, true);
    assert.equal(result.complete, i === 5);
    assert.equal(model.eggProgress, 0);
  }
  assert.deepEqual(ids, ['pipo', 'lili', 'tico', 'bubi', 'nino', 'zazu']);
  assert.deepEqual(plain(model.unlocked), ids);
  assert.deepEqual(plain(model.hatch()), { id: 'pipo', isNew: false, complete: true });
  model.select('tico');
  assert.deepEqual(plain(model.hatch()), { id: 'tico', isNew: false, complete: true });
  assert.equal(model.unlocked.length, 6);
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
  const model = load(storage).create();
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
  const model = load(storage).create(storage);
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
